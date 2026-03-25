import { SetMetadata } from '@nestjs/common';
import { AUDIT_METADATA_KEY } from '../authorization.constants';
import { AuditMetadata } from '../authorization.types';

export function Audit(
  metadata: AuditMetadata,
): MethodDecorator & ClassDecorator {
  return SetMetadata(AUDIT_METADATA_KEY, metadata);
}
