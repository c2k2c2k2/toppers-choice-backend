import { createHash, randomInt } from 'node:crypto';
import type { Request } from 'express';
import {
  PASSWORD_RESET_CODE_LENGTH,
} from './auth.constants';
import { RequestSessionMetadata } from './auth.types';

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createOtpCode(length = PASSWORD_RESET_CODE_LENGTH) {
  const minimum = 10 ** Math.max(length - 1, 0);
  const maximum = 10 ** length;

  return randomInt(minimum, maximum).toString().padStart(length, '0');
}

export function getRequestSessionMetadata(
  request: Request,
): RequestSessionMetadata {
  const userAgent = request.headers['user-agent'];

  return {
    ipAddress: request.ip ?? null,
    userAgent: typeof userAgent === 'string' ? userAgent : null,
  };
}
