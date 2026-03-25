import { Injectable } from '@nestjs/common';

@Injectable()
export class TestsEntitlementService {
  async canAccessTest(_userId: string, _testId: string) {
    // B11 introduces payment-backed entitlements. Until then, published tests
    // remain accessible to authenticated students through this explicit seam.
    return {
      allowed: true,
      reason: null as string | null,
    };
  }
}
