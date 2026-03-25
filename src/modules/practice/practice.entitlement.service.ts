import { Injectable } from '@nestjs/common';
import { PracticeMode, QuestionDifficulty } from '@prisma/client';

type PracticeAccessScope = {
  mode: PracticeMode;
  examTrackId: string | null;
  mediumId: string | null;
  subjectId: string | null;
  topicId: string | null;
  difficulty: QuestionDifficulty | null;
};

@Injectable()
export class PracticeEntitlementService {
  async canUsePractice(_userId: string, _scope: PracticeAccessScope) {
    // B11 introduces plan-backed entitlements. Until then, practice remains
    // available to authenticated students through this explicit seam.
    return {
      allowed: true,
      reason: null as string | null,
    };
  }
}
