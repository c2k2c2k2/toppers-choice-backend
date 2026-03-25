import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { RequestContextService } from '../../infra/request-context/request-context.service';

type NormalizedException = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly requestContextService: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const normalized = this.normalizeException(exception);
    const requestId =
      request.requestId ?? this.requestContextService.getRequestId() ?? null;

    if (!(exception instanceof HttpException) && normalized.status >= 500) {
      this.logger.error(
        `${normalized.code}: ${normalized.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(normalized.status).json({
      code: normalized.code,
      message: normalized.message,
      details: normalized.details ?? null,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
    });
  }

  private normalizeException(exception: unknown): NormalizedException {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return {
          status,
          code: this.toErrorCode(status),
          message: body,
        };
      }

      if (this.isRecord(body)) {
        const code =
          typeof body.code === 'string' ? body.code : this.toErrorCode(status);
        const message = this.extractMessage(body.message, exception.message);

        return {
          status,
          code,
          message,
          details: body.details,
        };
      }

      return {
        status,
        code: this.toErrorCode(status),
        message: exception.message,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with the same unique value already exists.',
          details: { target: exception.meta?.target ?? null },
        };
      }

      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested record was not found.',
        };
      }

      return {
        status: HttpStatus.BAD_REQUEST,
        code: 'DATABASE_REQUEST_FAILED',
        message: 'A database request failed.',
        details: { prismaCode: exception.code },
      };
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connectivity is not available.',
        details: { reason: exception.message },
      };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private extractMessage(value: unknown, fallback: string): string {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(', ');
    }

    return fallback;
  }

  private toErrorCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      case 429:
        return 'TOO_MANY_REQUESTS';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'HTTP_ERROR';
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
