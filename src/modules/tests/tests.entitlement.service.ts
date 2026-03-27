import { Injectable } from '@nestjs/common';
import { EntitlementKind, TestAccessType } from '@prisma/client';
import { EntitlementsService } from '../payments/entitlements.service';

@Injectable()
export class TestsEntitlementService {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async canAccessTest(
    siteId: string,
    userId: string,
    test: {
      id: string;
      accessType: TestAccessType;
      family: string;
      examTrackId: string | null;
      mediumId: string | null;
      subjectId: string | null;
    },
  ) {
    if (test.accessType === TestAccessType.FREE) {
      return {
        allowed: true,
        reason: null as string | null,
      };
    }

    const allowed = await this.entitlementsService.hasEntitlement(
      siteId,
      userId,
      [EntitlementKind.TESTS_PREMIUM],
      {
        testId: test.id,
        family: test.family,
        examTrackId: test.examTrackId,
        mediumId: test.mediumId,
        subjectId: test.subjectId,
      },
    );

    return {
      allowed,
      reason: allowed
        ? null
        : 'Active premium entitlement is required for this test.',
    };
  }
}
