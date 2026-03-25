import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentEntitlementService {
  async canAccessPremiumContent(_userId: string, _contentEntryId: string) {
    // B11 introduces payment-backed entitlements. Until then, premium
    // structured content remains locked for students unless bypassed by
    // admin access in the calling service.
    return false;
  }
}
