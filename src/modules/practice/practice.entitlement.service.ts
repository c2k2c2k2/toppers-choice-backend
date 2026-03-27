import { Injectable } from '@nestjs/common';
import { PracticeMode, QuestionDifficulty } from '@prisma/client';
import { EntitlementsService } from '../payments/entitlements.service';

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
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async canUsePractice(
    siteId: string,
    userId: string,
    scope: PracticeAccessScope,
  ) {
    return this.entitlementsService.canUsePractice(siteId, userId, {
      mode: scope.mode,
      examTrackId: scope.examTrackId,
      mediumId: scope.mediumId,
      subjectId: scope.subjectId,
      topicId: scope.topicId,
      difficulty: scope.difficulty,
    });
  }
}
