import { SetMetadata } from '@nestjs/common';
import {
  DEFAULT_ADMIN_POLICY,
  POLICY_METADATA_KEY,
} from '../authorization.constants';
import { PolicyRequirement } from '../authorization.types';

export function Policy(
  policy: string | string[] | PolicyRequirement,
): MethodDecorator & ClassDecorator {
  const normalized: PolicyRequirement = normalizePolicy(policy);
  return SetMetadata(POLICY_METADATA_KEY, normalized);
}

function normalizePolicy(
  policy: string | string[] | PolicyRequirement,
): PolicyRequirement {
  if (typeof policy === 'string') {
    return {
      ...DEFAULT_ADMIN_POLICY,
      permissions: [policy],
    };
  }

  if (Array.isArray(policy)) {
    return {
      ...DEFAULT_ADMIN_POLICY,
      permissions: [...policy],
    };
  }

  return {
    ...DEFAULT_ADMIN_POLICY,
    ...policy,
    permissions: policy.permissions ? [...policy.permissions] : [],
  };
}
