import { Injectable } from '@nestjs/common';
import { EntitlementKind } from '@prisma/client';
import { EntitlementsService } from '../payments/entitlements.service';

@Injectable()
export class EnglishSpeakingEntitlementService {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async canAccessPremiumTopics(siteId: string, userId: string) {
    const hasBroadPremiumAccess = await this.entitlementsService.hasEntitlement(
      siteId,
      userId,
      [
        EntitlementKind.CONTENT_PREMIUM,
        EntitlementKind.NOTES_PREMIUM,
        EntitlementKind.PRACTICE_PREMIUM,
        EntitlementKind.TESTS_PREMIUM,
      ],
    );

    if (hasBroadPremiumAccess) {
      return true;
    }

    return this.entitlementsService.hasEntitlement(
      siteId,
      userId,
      [EntitlementKind.CONTENT_PREMIUM],
      {
        family: 'ENGLISH_SPEAKING',
      },
    );
  }
}
