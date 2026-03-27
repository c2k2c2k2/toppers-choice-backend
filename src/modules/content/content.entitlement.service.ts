import { Injectable } from '@nestjs/common';
import { EntitlementKind } from '@prisma/client';
import { EntitlementsService } from '../payments/entitlements.service';
import { ContentEntryRecord } from './content.types';

@Injectable()
export class ContentEntitlementService {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async canAccessPremiumContent(
    siteId: string,
    userId: string,
    entry: Pick<
      ContentEntryRecord,
      'id' | 'family' | 'examTrackLinks' | 'mediumLinks'
    >,
  ) {
    return this.entitlementsService.hasEntitlement(
      siteId,
      userId,
      [EntitlementKind.CONTENT_PREMIUM],
      {
        contentEntryId: entry.id,
        family: entry.family,
        examTrackIds: entry.examTrackLinks.map(({ examTrack }) => examTrack.id),
        mediumIds: entry.mediumLinks.map(({ medium }) => medium.id),
      },
    );
  }
}
