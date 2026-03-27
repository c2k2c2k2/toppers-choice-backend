import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedUser } from '../../modules/auth/auth.types';
import {
  THROTTLE_METADATA_KEY,
  type ThrottleMetadata,
} from './throttle.decorator';

type ThrottleRequest = Request & {
  user?: AuthenticatedUser;
};

@Injectable()
export class ThrottleGuard implements CanActivate {
  private static readonly buckets = new Map<string, number[]>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const metadata = this.reflector.getAllAndOverride<ThrottleMetadata>(
      THROTTLE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ThrottleRequest>();
    const now = Date.now();
    const windowMs = metadata.windowSeconds * 1000;
    const bucketKey = this.buildBucketKey(request, metadata);
    const currentBucket = ThrottleGuard.buckets.get(bucketKey) ?? [];
    const activeBucket = currentBucket.filter(
      (timestamp) => now - timestamp < windowMs,
    );

    if (activeBucket.length >= metadata.limit) {
      throw new HttpException(
        {
          code: 'THROTTLE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    activeBucket.push(now);
    ThrottleGuard.buckets.set(bucketKey, activeBucket);
    this.prune(now);

    return true;
  }

  private buildBucketKey(request: ThrottleRequest, metadata: ThrottleMetadata) {
    const actorKey =
      request.user?.userId ??
      request.ip ??
      request.headers['x-forwarded-for'] ??
      'anonymous';
    const routeKey =
      metadata.keyPrefix ??
      `${request.method}:${request.baseUrl}${request.route?.path ?? request.path}`;

    return `${routeKey}:${String(actorKey)}`;
  }

  private prune(now: number) {
    if (ThrottleGuard.buckets.size < 250) {
      return;
    }

    for (const [bucketKey, timestamps] of ThrottleGuard.buckets.entries()) {
      const nextTimestamps = timestamps.filter(
        (timestamp) => now - timestamp < 3_600_000,
      );

      if (nextTimestamps.length === 0) {
        ThrottleGuard.buckets.delete(bucketKey);
        continue;
      }

      ThrottleGuard.buckets.set(bucketKey, nextTimestamps);
    }
  }
}
