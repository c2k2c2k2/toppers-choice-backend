import { SetMetadata } from '@nestjs/common';

export const THROTTLE_METADATA_KEY = 'common:throttle';

export type ThrottleMetadata = {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
};

export function Throttle(
  limit: number,
  windowSeconds: number,
  keyPrefix?: string,
): MethodDecorator & ClassDecorator {
  return SetMetadata(THROTTLE_METADATA_KEY, {
    limit,
    windowSeconds,
    keyPrefix,
  } satisfies ThrottleMetadata);
}
