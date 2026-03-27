import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { IdempotencyRecordStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type IdempotentExecutionOptions = {
  siteId: string;
  userId?: string | null;
  scope: string;
  key?: string | null;
  requestBody: unknown;
  resourceType?: string;
  ttlMinutes?: number;
};

type StoredResponse =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null;

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T extends StoredResponse>(
    options: IdempotentExecutionOptions,
    handler: () => Promise<T>,
  ): Promise<T> {
    const idempotencyKey = options.key?.trim();

    if (!idempotencyKey) {
      return handler();
    }

    const requestHash = this.hashValue(options.requestBody);
    const expiresAt = this.resolveExpiry(options.ttlMinutes);
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        siteId_scope_key: {
          siteId: options.siteId,
          scope: options.scope,
          key: idempotencyKey,
        },
      },
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
          message:
            'The provided idempotency key was already used with a different request payload.',
        });
      }

      if (
        existing.status === IdempotencyRecordStatus.COMPLETED &&
        existing.responseJson !== null
      ) {
        return existing.responseJson as T;
      }

      throw new ConflictException({
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        message:
          'A request with this idempotency key is already being processed or previously failed.',
      });
    }

    await this.prisma.idempotencyRecord.create({
      data: {
        siteId: options.siteId,
        userId: options.userId ?? null,
        scope: options.scope,
        key: idempotencyKey,
        requestHash,
        expiresAt,
      },
    });

    try {
      const response = await handler();

      await this.prisma.idempotencyRecord.update({
        where: {
          siteId_scope_key: {
            siteId: options.siteId,
            scope: options.scope,
            key: idempotencyKey,
          },
        },
        data: {
          status: IdempotencyRecordStatus.COMPLETED,
          responseJson: this.toJsonValue(response),
          resourceType: options.resourceType ?? null,
          resourceId: this.extractResourceId(response),
          completedAt: new Date(),
        },
      });

      return response;
    } catch (error) {
      await this.prisma.idempotencyRecord.update({
        where: {
          siteId_scope_key: {
            siteId: options.siteId,
            scope: options.scope,
            key: idempotencyKey,
          },
        },
        data: {
          status: IdempotencyRecordStatus.FAILED,
          errorCode: this.extractErrorCode(error),
        },
      });

      throw error;
    }
  }

  private resolveExpiry(ttlMinutes?: number) {
    const ttl = ttlMinutes ?? 60;
    return new Date(Date.now() + ttl * 60_000);
  }

  private extractResourceId(response: StoredResponse) {
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const id = response['id'];
      return typeof id === 'string' && id.length > 0 ? id : null;
    }

    return null;
  }

  private extractErrorCode(error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = error.response;
      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return response.code;
      }
    }

    return null;
  }

  private hashValue(value: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(value) ?? 'null')
      .digest('hex');
  }

  private toJsonValue(value: StoredResponse): Prisma.InputJsonValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value === null
        ? (Prisma.JsonNull as unknown as Prisma.InputJsonValue)
        : value;
    }

    if (Array.isArray(value)) {
      return value as Prisma.InputJsonValue;
    }

    if (typeof value === 'object') {
      return value as Prisma.InputJsonValue;
    }

    throw new InternalServerErrorException({
      code: 'IDEMPOTENCY_RESPONSE_SERIALIZATION_FAILED',
      message: 'Idempotent response could not be serialized.',
    });
  }
}
