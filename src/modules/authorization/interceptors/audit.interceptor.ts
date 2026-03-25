import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, mergeMap, of } from 'rxjs';
import { AUDIT_METADATA_KEY } from '../authorization.constants';
import { AuditService } from '../audit.service';
import { AuditMetadata } from '../authorization.types';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    return next.handle().pipe(
      mergeMap(async (responseBody) => {
        if (user) {
          await this.auditService.createAuditLog({
            siteId: user.siteId,
            actorUserId: user.userId,
            action: metadata.action,
            resourceType: metadata.resourceType,
            resourceId: this.resolveResourceId(metadata, request, responseBody),
            meta: this.buildMetadataPayload(metadata, request, responseBody),
            ipAddress: request.ip ?? null,
            userAgent:
              typeof request.headers['user-agent'] === 'string'
                ? request.headers['user-agent']
                : null,
          });
        }

        return responseBody;
      }),
    );
  }

  private resolveResourceId(
    metadata: AuditMetadata,
    request: Request,
    responseBody: unknown,
  ) {
    if (metadata.resourceIdParam) {
      const fromParams = request.params?.[metadata.resourceIdParam];
      if (typeof fromParams === 'string' && fromParams.length > 0) {
        return fromParams;
      }
    }

    if (metadata.resourceIdBodyField) {
      const fromBody = this.getValueFromRecord(request.body, metadata.resourceIdBodyField);
      if (typeof fromBody === 'string' && fromBody.length > 0) {
        return fromBody;
      }
    }

    if (metadata.resourceIdResponseField) {
      const fromResponse = this.getValueFromRecord(
        responseBody,
        metadata.resourceIdResponseField,
      );
      if (typeof fromResponse === 'string' && fromResponse.length > 0) {
        return fromResponse;
      }
    }

    return null;
  }

  private buildMetadataPayload(
    metadata: AuditMetadata,
    request: Request,
    responseBody: unknown,
  ) {
    const payload: Record<string, unknown> = {
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode: contextStatusCode(responseBody),
    };

    if (metadata.includeParams ?? true) {
      payload.params = request.params;
    }

    if (metadata.includeQuery) {
      payload.query = request.query;
    }

    if (metadata.includeBodyKeys && metadata.includeBodyKeys.length > 0) {
      payload.body = metadata.includeBodyKeys.reduce<Record<string, unknown>>(
        (accumulator, key) => {
          const value = this.getValueFromRecord(request.body, key);
          if (value !== undefined) {
            accumulator[key] = sanitizeAuditValue(value);
          }
          return accumulator;
        },
        {},
      );
    }

    const responseId = this.getValueFromRecord(responseBody, 'id');
    if (responseId !== undefined) {
      payload.response = {
        id: responseId,
      };
    }

    return payload;
  }

  private getValueFromRecord(value: unknown, path: string) {
    return path.split('.').reduce<unknown>((currentValue, segment) => {
      if (!isRecord(currentValue)) {
        return undefined;
      }

      return currentValue[segment];
    }, value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [
        key,
        /password|token|secret|code/iu.test(key)
          ? '[redacted]'
          : sanitizeAuditValue(currentValue),
      ]),
    );
  }

  return value;
}

function contextStatusCode(_responseBody: unknown) {
  return 200;
}
