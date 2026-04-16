import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogVisibility,
  PracticeMode,
  PracticeQuestionEventType,
  PracticeSessionStatus,
  Prisma,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { questionSelect } from '../questions/questions.types';
import type {
  EndPracticeSessionDto,
  GetNextPracticeQuestionsQueryDto,
  ListPracticeSessionsQueryDto,
  ListPracticeTrendsQueryDto,
  ListSubjectPracticeProgressQueryDto,
  ListTopicPracticeProgressQueryDto,
  ListWeakPracticeQuestionsQueryDto,
  RevealPracticeQuestionDto,
  SavePracticeAnswerDto,
  StartPracticeSessionDto,
  SubmitPracticeAnswerDto,
} from './dto/manage-practice.dto';
import {
  mapPracticeSessionDetail,
  mapPracticeSessionQuestion,
  mapPracticeSessionSummary,
  mapSubjectPracticeProgress,
  mapTopicPracticeProgress,
  practiceSessionDetailSelect,
  practiceSessionQuestionSelect,
  practiceSessionSummarySelect,
  subjectPracticeProgressSelect,
  topicPracticeProgressSelect,
  type PracticeSessionQuestionRecord,
  type PracticeSessionSummaryRecord,
} from './practice.types';
import { PracticeEntitlementService } from './practice.entitlement.service';
import { PracticeSettingsService } from './practice.settings.service';
import {
  calculateAccuracyPercent,
  clampNumber,
  getDateKey,
  normalizeAnswerText,
  normalizeOptionKeys,
} from './practice.utils';

type PracticeScope = {
  mode: PracticeMode;
  examTrackId: string | null;
  mediumId: string | null;
  subjectId: string | null;
  topicId: string | null;
  difficulty: QuestionDifficulty | null;
};

type QuestionRecord = Prisma.QuestionGetPayload<{
  select: typeof questionSelect;
}>;

type SessionQuestionMutationRecord = Prisma.PracticeSessionQuestionGetPayload<{
  select: typeof practiceSessionQuestionSelect & {
    practiceSession: {
      select: typeof practiceSessionSummarySelect;
    };
    question: {
      select: typeof questionSelect;
    };
  };
}>;

@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly practiceSettingsService: PracticeSettingsService,
    private readonly practiceEntitlementService: PracticeEntitlementService,
  ) {}

  async startSession(user: AuthenticatedUser, input: StartPracticeSessionDto) {
    this.assertStudentUser(user);

    const [resolvedScope, defaultQuestionCount, maxQuestionCount] =
      await Promise.all([
        this.validateAndResolveScope(user.siteId, input),
        this.practiceSettingsService.getDefaultQuestionCount(),
        this.practiceSettingsService.getMaxQuestionCount(),
      ]);

    const access = await this.practiceEntitlementService.canUsePractice(
      user.siteId,
      user.userId,
      resolvedScope,
    );
    if (!access.allowed) {
      throw new ForbiddenException({
        code: 'PRACTICE_ACCESS_DENIED',
        message: access.reason ?? 'You cannot start practice right now.',
      });
    }

    const totalAvailableQuestions = await this.prisma.question.count({
      where: this.buildQuestionScopeWhere(user.siteId, resolvedScope),
    });

    if (totalAvailableQuestions === 0) {
      throw new BadRequestException({
        code: 'PRACTICE_NO_QUESTIONS_AVAILABLE',
        message: 'No published questions match the selected practice scope.',
      });
    }

    const requestedQuestionCount = clampNumber(
      input.questionCount ?? defaultQuestionCount,
      1,
      maxQuestionCount,
    );
    const questionCountTarget = Math.min(
      requestedQuestionCount,
      totalAvailableQuestions,
    );
    const [defaultBatchSize, maxBatchSize] = await Promise.all([
      this.practiceSettingsService.getDefaultBatchSize(),
      this.practiceSettingsService.getMaxBatchSize(),
    ]);

    const session = await this.prisma.practiceSession.create({
      data: {
        siteId: user.siteId,
        userId: user.userId,
        authSessionId: user.sessionId,
        mode: resolvedScope.mode,
        examTrackId: resolvedScope.examTrackId,
        mediumId: resolvedScope.mediumId,
        subjectId: resolvedScope.subjectId,
        topicId: resolvedScope.topicId,
        difficulty: resolvedScope.difficulty,
        questionCountTarget,
        configJson: {
          selection: {
            totalAvailableQuestions,
          },
          delivery: {
            defaultBatchSize,
            maxBatchSize,
          },
        } satisfies Prisma.JsonObject,
      },
      select: practiceSessionSummarySelect,
    });

    return mapPracticeSessionSummary(session);
  }

  async listSessions(
    user: AuthenticatedUser,
    query: ListPracticeSessionsQueryDto,
  ) {
    this.assertStudentUser(user);

    const take = clampNumber(query.limit ?? 20, 1, 50);
    const where: Prisma.PracticeSessionWhereInput = {
      siteId: user.siteId,
      userId: user.userId,
      status: query.status,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.practiceSession.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }],
        take,
        select: practiceSessionSummarySelect,
      }),
      this.prisma.practiceSession.count({ where }),
    ]);

    return {
      items: items.map((item) => mapPracticeSessionSummary(item)),
      total,
    };
  }

  async getSession(user: AuthenticatedUser, sessionId: string) {
    this.assertStudentUser(user);

    const session = await this.prisma.practiceSession.findFirst({
      where: {
        id: sessionId,
        siteId: user.siteId,
        userId: user.userId,
      },
      select: practiceSessionDetailSelect,
    });

    if (!session) {
      throw new NotFoundException({
        code: 'PRACTICE_SESSION_NOT_FOUND',
        message: 'Practice session was not found.',
      });
    }

    return mapPracticeSessionDetail(session);
  }

  async getNextQuestions(
    user: AuthenticatedUser,
    sessionId: string,
    query: GetNextPracticeQuestionsQueryDto,
  ) {
    this.assertStudentUser(user);

    const session = await this.getOwnedSessionSummary(user, sessionId);
    this.assertActiveSession(session);

    const [defaultBatchSize, maxBatchSize] = await Promise.all([
      this.practiceSettingsService.getDefaultBatchSize(),
      this.practiceSettingsService.getMaxBatchSize(),
    ]);
    const batchSize = clampNumber(
      query.batchSize ?? defaultBatchSize,
      1,
      maxBatchSize,
    );
    const remainingTarget = Math.max(
      session.questionCountTarget - session.servedCount,
      0,
    );

    if (remainingTarget <= 0) {
      return {
        session: mapPracticeSessionSummary(session),
        items: [],
        hasMore: false,
      };
    }

    const servedQuestionIds =
      await this.prisma.practiceSessionQuestion.findMany({
        where: {
          practiceSessionId: sessionId,
        },
        select: {
          questionId: true,
        },
      });

    const questions = await this.selectQuestionsForSession(
      user.siteId,
      user.userId,
      session,
      servedQuestionIds.map((item) => item.questionId),
      Math.min(batchSize, remainingTarget),
    );

    if (questions.length === 0) {
      return {
        session: mapPracticeSessionSummary(session),
        items: [],
        hasMore: false,
      };
    }

    const now = new Date();
    const createdIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const [index, question] of questions.entries()) {
        const created = await tx.practiceSessionQuestion.create({
          data: {
            siteId: user.siteId,
            userId: user.userId,
            practiceSessionId: session.id,
            questionId: question.id,
            orderIndex: session.servedCount + index,
          },
          select: {
            id: true,
          },
        });

        createdIds.push(created.id);

        await tx.practiceQuestionEvent.create({
          data: {
            siteId: user.siteId,
            userId: user.userId,
            practiceSessionId: session.id,
            practiceSessionQuestionId: created.id,
            questionId: question.id,
            eventType: PracticeQuestionEventType.SERVED,
          },
        });

        await tx.userQuestionPracticeState.upsert({
          where: {
            questionId_userId: {
              questionId: question.id,
              userId: user.userId,
            },
          },
          update: {
            seenCount: {
              increment: 1,
            },
            lastServedAt: now,
            siteId: user.siteId,
          },
          create: {
            questionId: question.id,
            userId: user.userId,
            siteId: user.siteId,
            seenCount: 1,
            lastServedAt: now,
          },
        });
      }

      await this.incrementServedProgress(
        tx,
        user.siteId,
        user.userId,
        questions,
        now,
      );

      await tx.practiceSession.update({
        where: {
          id: session.id,
        },
        data: {
          servedCount: {
            increment: questions.length,
          },
          lastActivityAt: now,
        },
      });
    });

    const [updatedSession, sessionQuestions] = await Promise.all([
      this.getOwnedSessionSummary(user, sessionId),
      this.prisma.practiceSessionQuestion.findMany({
        where: {
          id: {
            in: createdIds,
          },
        },
        orderBy: [{ orderIndex: 'asc' }],
        select: practiceSessionQuestionSelect,
      }),
    ]);

    const totalAvailableQuestions = this.getTotalAvailableQuestions(
      updatedSession.configJson,
    );
    const hasMore =
      totalAvailableQuestions === null
        ? questions.length === Math.min(batchSize, remainingTarget)
        : updatedSession.servedCount < totalAvailableQuestions &&
          updatedSession.servedCount < updatedSession.questionCountTarget;

    return {
      session: mapPracticeSessionSummary(updatedSession),
      items: sessionQuestions.map((item) => mapPracticeSessionQuestion(item)),
      hasMore,
    };
  }

  async saveAnswer(
    user: AuthenticatedUser,
    sessionId: string,
    input: SavePracticeAnswerDto,
  ) {
    this.assertStudentUser(user);

    const sessionQuestion = await this.getOwnedSessionQuestion(
      user,
      sessionId,
      input.questionId,
    );
    this.assertActiveSession(sessionQuestion.practiceSession);

    if (sessionQuestion.answeredAt) {
      throw new BadRequestException({
        code: 'PRACTICE_ANSWER_ALREADY_SUBMITTED',
        message: 'This question has already been answered in the session.',
      });
    }

    const answerJson = this.ensureAnswerRecord(input.answerJson);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.practiceSessionQuestion.update({
        where: {
          id: sessionQuestion.id,
        },
        data: {
          latestSavedAnswerJson: answerJson as Prisma.InputJsonValue,
          lastSavedAt: now,
        },
      });

      await tx.practiceQuestionEvent.create({
        data: {
          siteId: user.siteId,
          userId: user.userId,
          practiceSessionId: sessionQuestion.practiceSession.id,
          practiceSessionQuestionId: sessionQuestion.id,
          questionId: sessionQuestion.questionId,
          eventType: PracticeQuestionEventType.SAVED,
          answerJson: answerJson as Prisma.InputJsonValue,
        },
      });

      await tx.practiceSession.update({
        where: {
          id: sessionQuestion.practiceSession.id,
        },
        data: {
          lastActivityAt: now,
        },
      });
    });

    const updatedSession = await this.getOwnedSessionSummary(user, sessionId);

    return {
      questionId: sessionQuestion.questionId,
      answerJson,
      lastSavedAt: now,
      session: mapPracticeSessionSummary(updatedSession),
    };
  }

  async submitAnswer(
    user: AuthenticatedUser,
    sessionId: string,
    input: SubmitPracticeAnswerDto,
  ) {
    this.assertStudentUser(user);

    const sessionQuestion = await this.getOwnedSessionQuestion(
      user,
      sessionId,
      input.questionId,
    );
    this.assertActiveSession(sessionQuestion.practiceSession);

    if (sessionQuestion.answeredAt) {
      throw new BadRequestException({
        code: 'PRACTICE_ANSWER_ALREADY_SUBMITTED',
        message: 'This question has already been answered in the session.',
      });
    }

    const answerJson = this.normalizeFinalAnswer(
      sessionQuestion.question.type,
      input.answerJson,
    );
    const isCorrect = this.evaluateAnswer(sessionQuestion.question, answerJson);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.practiceSessionQuestion.update({
        where: {
          id: sessionQuestion.id,
        },
        data: {
          latestSavedAnswerJson: answerJson as Prisma.InputJsonValue,
          lastSavedAt: now,
          answerJson: answerJson as Prisma.InputJsonValue,
          answeredAt: now,
          isCorrect,
        },
      });

      await tx.practiceQuestionEvent.create({
        data: {
          siteId: user.siteId,
          userId: user.userId,
          practiceSessionId: sessionQuestion.practiceSession.id,
          practiceSessionQuestionId: sessionQuestion.id,
          questionId: sessionQuestion.questionId,
          eventType: PracticeQuestionEventType.ANSWERED,
          answerJson: answerJson as Prisma.InputJsonValue,
          isCorrect,
          responseTimeMs: input.responseTimeMs ?? null,
        },
      });

      await tx.practiceSession.update({
        where: {
          id: sessionQuestion.practiceSession.id,
        },
        data: {
          answeredCount: {
            increment: 1,
          },
          correctCount: {
            increment: isCorrect ? 1 : 0,
          },
          wrongCount: {
            increment: isCorrect ? 0 : 1,
          },
          lastActivityAt: now,
        },
      });

      await tx.userQuestionPracticeState.upsert({
        where: {
          questionId_userId: {
            questionId: sessionQuestion.questionId,
            userId: user.userId,
          },
        },
        update: {
          answerCount: {
            increment: 1,
          },
          correctCount: {
            increment: isCorrect ? 1 : 0,
          },
          wrongCount: {
            increment: isCorrect ? 0 : 1,
          },
          lastAnsweredAt: now,
          lastIsCorrect: isCorrect,
          siteId: user.siteId,
        },
        create: {
          questionId: sessionQuestion.questionId,
          userId: user.userId,
          siteId: user.siteId,
          answerCount: 1,
          correctCount: isCorrect ? 1 : 0,
          wrongCount: isCorrect ? 0 : 1,
          lastAnsweredAt: now,
          lastIsCorrect: isCorrect,
        },
      });

      await this.incrementAnsweredProgress(
        tx,
        user.siteId,
        user.userId,
        sessionQuestion.question,
        isCorrect,
        now,
      );
    });

    const updatedSession = await this.getOwnedSessionSummary(user, sessionId);

    return {
      questionId: sessionQuestion.questionId,
      answerJson,
      isCorrect,
      answeredAt: now,
      session: mapPracticeSessionSummary(updatedSession),
    };
  }

  async revealAnswer(
    user: AuthenticatedUser,
    sessionId: string,
    input: RevealPracticeQuestionDto,
  ) {
    this.assertStudentUser(user);

    const sessionQuestion = await this.getOwnedSessionQuestion(
      user,
      sessionId,
      input.questionId,
    );
    this.assertActiveSession(sessionQuestion.practiceSession);

    const now = new Date();
    if (!sessionQuestion.revealedAt) {
      await this.prisma.$transaction(async (tx) => {
        await tx.practiceSessionQuestion.update({
          where: {
            id: sessionQuestion.id,
          },
          data: {
            revealedAt: now,
          },
        });

        await tx.practiceQuestionEvent.create({
          data: {
            siteId: user.siteId,
            userId: user.userId,
            practiceSessionId: sessionQuestion.practiceSession.id,
            practiceSessionQuestionId: sessionQuestion.id,
            questionId: sessionQuestion.questionId,
            eventType: PracticeQuestionEventType.REVEALED,
          },
        });

        await tx.practiceSession.update({
          where: {
            id: sessionQuestion.practiceSession.id,
          },
          data: {
            revealedCount: {
              increment: 1,
            },
            lastActivityAt: now,
          },
        });

        await tx.userQuestionPracticeState.upsert({
          where: {
            questionId_userId: {
              questionId: sessionQuestion.questionId,
              userId: user.userId,
            },
          },
          update: {
            revealCount: {
              increment: 1,
            },
            lastRevealedAt: now,
            siteId: user.siteId,
          },
          create: {
            questionId: sessionQuestion.questionId,
            userId: user.userId,
            siteId: user.siteId,
            revealCount: 1,
            lastRevealedAt: now,
          },
        });

        await this.incrementRevealProgress(
          tx,
          user.siteId,
          user.userId,
          sessionQuestion.question,
          now,
        );
      });
    }

    const updatedSession = await this.getOwnedSessionSummary(user, sessionId);

    return {
      questionId: sessionQuestion.questionId,
      revealedAt: sessionQuestion.revealedAt ?? now,
      correctAnswerJson: sessionQuestion.question.correctAnswerJson as Record<
        string,
        unknown
      >,
      explanationJson:
        sessionQuestion.question.explanationJson &&
        typeof sessionQuestion.question.explanationJson === 'object'
          ? (sessionQuestion.question.explanationJson as Record<
              string,
              unknown
            >)
          : null,
      session: mapPracticeSessionSummary(updatedSession),
    };
  }

  async endSession(
    user: AuthenticatedUser,
    sessionId: string,
    input: EndPracticeSessionDto,
  ) {
    this.assertStudentUser(user);

    const session = await this.getOwnedSessionSummary(user, sessionId);
    if (session.status !== PracticeSessionStatus.ACTIVE) {
      return mapPracticeSessionSummary(session);
    }

    const ended = await this.prisma.practiceSession.update({
      where: {
        id: sessionId,
      },
      data: {
        status: input.abandon
          ? PracticeSessionStatus.ABANDONED
          : PracticeSessionStatus.COMPLETED,
        endedAt: new Date(),
        lastActivityAt: new Date(),
      },
      select: practiceSessionSummarySelect,
    });

    return mapPracticeSessionSummary(ended);
  }

  async listSubjectProgress(
    user: AuthenticatedUser,
    query: ListSubjectPracticeProgressQueryDto,
  ) {
    this.assertStudentUser(user);

    const items = await this.prisma.userSubjectPracticeProgress.findMany({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        subject: query.examTrackId
          ? {
              examTrackId: query.examTrackId,
            }
          : undefined,
      },
      orderBy: [{ lastPracticedAt: 'desc' }, { updatedAt: 'desc' }],
      select: subjectPracticeProgressSelect,
    });

    return {
      items: items.map((item) => mapSubjectPracticeProgress(item)),
    };
  }

  async listTopicProgress(
    user: AuthenticatedUser,
    query: ListTopicPracticeProgressQueryDto,
  ) {
    this.assertStudentUser(user);

    const items = await this.prisma.userTopicPracticeProgress.findMany({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        subjectId: query.subjectId,
        subject: query.examTrackId
          ? {
              examTrackId: query.examTrackId,
            }
          : undefined,
      },
      orderBy: [{ lastPracticedAt: 'desc' }, { updatedAt: 'desc' }],
      select: topicPracticeProgressSelect,
    });

    return {
      items: items.map((item) => mapTopicPracticeProgress(item)),
    };
  }

  async listWeakQuestions(
    user: AuthenticatedUser,
    query: ListWeakPracticeQuestionsQueryDto,
  ) {
    this.assertStudentUser(user);

    const take = clampNumber(query.limit ?? 20, 1, 100);
    const where: Prisma.UserQuestionPracticeStateWhereInput = {
      siteId: user.siteId,
      userId: user.userId,
      OR: [{ wrongCount: { gt: 0 } }, { revealCount: { gt: 0 } }],
      question: {
        is: {
          status: QuestionStatus.PUBLISHED,
          subjectId: query.subjectId,
          topicId: query.topicId,
        },
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.userQuestionPracticeState.findMany({
        where,
        orderBy: [
          { wrongCount: 'desc' },
          { revealCount: 'desc' },
          { lastAnsweredAt: 'asc' },
          { updatedAt: 'asc' },
        ],
        take,
        select: {
          questionId: true,
          answerCount: true,
          correctCount: true,
          wrongCount: true,
          revealCount: true,
          lastAnsweredAt: true,
          question: {
            select: questionSelect,
          },
        },
      }),
      this.prisma.userQuestionPracticeState.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        questionId: item.questionId,
        code: item.question.code,
        statementJson: item.question.statementJson as Record<string, unknown>,
        difficulty: item.question.difficulty,
        examTrack: item.question.subject.examTrack,
        subject: {
          id: item.question.subject.id,
          code: item.question.subject.code,
          slug: item.question.subject.slug,
          name: item.question.subject.name,
        },
        topic: item.question.topic,
        answerCount: item.answerCount,
        correctCount: item.correctCount,
        wrongCount: item.wrongCount,
        revealCount: item.revealCount,
        accuracyPercent: calculateAccuracyPercent(
          item.correctCount,
          item.answerCount,
        ),
        lastAnsweredAt: item.lastAnsweredAt,
      })),
      total,
    };
  }

  async getTrends(user: AuthenticatedUser, query: ListPracticeTrendsQueryDto) {
    this.assertStudentUser(user);

    const maxWindowDays =
      await this.practiceSettingsService.getTrendWindowDays();
    const days = clampNumber(query.days ?? maxWindowDays, 1, maxWindowDays);
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);

    const events = await this.prisma.practiceQuestionEvent.findMany({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        createdAt: {
          gte: start,
        },
        eventType: {
          in: [
            PracticeQuestionEventType.SERVED,
            PracticeQuestionEventType.SAVED,
            PracticeQuestionEventType.ANSWERED,
            PracticeQuestionEventType.REVEALED,
          ],
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        eventType: true,
        isCorrect: true,
        createdAt: true,
      },
    });

    const points = new Map<
      string,
      {
        date: string;
        servedCount: number;
        savedCount: number;
        answeredCount: number;
        correctCount: number;
        wrongCount: number;
        revealedCount: number;
      }
    >();

    for (let index = 0; index < days; index += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const key = getDateKey(date);
      points.set(key, {
        date: key,
        servedCount: 0,
        savedCount: 0,
        answeredCount: 0,
        correctCount: 0,
        wrongCount: 0,
        revealedCount: 0,
      });
    }

    for (const event of events) {
      const key = getDateKey(event.createdAt);
      const point = points.get(key);
      if (!point) {
        continue;
      }

      switch (event.eventType) {
        case PracticeQuestionEventType.SERVED:
          point.servedCount += 1;
          break;
        case PracticeQuestionEventType.SAVED:
          point.savedCount += 1;
          break;
        case PracticeQuestionEventType.ANSWERED:
          point.answeredCount += 1;
          if (event.isCorrect) {
            point.correctCount += 1;
          } else {
            point.wrongCount += 1;
          }
          break;
        case PracticeQuestionEventType.REVEALED:
          point.revealedCount += 1;
          break;
      }
    }

    return {
      days,
      items: Array.from(points.values()),
    };
  }

  private assertStudentUser(user: AuthenticatedUser) {
    if (user.userType !== UserType.STUDENT) {
      throw new ForbiddenException({
        code: 'PRACTICE_STUDENT_ACCESS_REQUIRED',
        message: 'Practice is available only for student users.',
      });
    }
  }

  private async validateAndResolveScope(
    siteId: string,
    input: StartPracticeSessionDto,
  ): Promise<PracticeScope> {
    if (input.mode === PracticeMode.TOPIC_WISE && !input.topicId) {
      throw new BadRequestException({
        code: 'PRACTICE_TOPIC_REQUIRED',
        message: 'Topic-wise practice requires a topic selection.',
      });
    }

    let resolvedExamTrackId = input.examTrackId ?? null;
    let resolvedSubjectId = input.subjectId ?? null;
    let resolvedTopicId = input.topicId ?? null;

    if (input.examTrackId) {
      const examTrack = await this.prisma.examTrack.findFirst({
        where: {
          id: input.examTrackId,
          siteId,
          isActive: true,
          visibility: {
            not: CatalogVisibility.INTERNAL,
          },
        },
        select: {
          id: true,
        },
      });

      if (!examTrack) {
        throw new BadRequestException({
          code: 'PRACTICE_EXAM_TRACK_INVALID',
          message: 'Exam track was not found for this site.',
        });
      }
    }

    if (input.mediumId) {
      const medium = await this.prisma.medium.findFirst({
        where: {
          id: input.mediumId,
          siteId,
          isActive: true,
          visibility: {
            not: CatalogVisibility.INTERNAL,
          },
        },
        select: {
          id: true,
        },
      });

      if (!medium) {
        throw new BadRequestException({
          code: 'PRACTICE_MEDIUM_INVALID',
          message: 'Medium was not found for this site.',
        });
      }
    }

    if (input.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          id: input.subjectId,
          siteId,
          isActive: true,
          visibility: {
            not: CatalogVisibility.INTERNAL,
          },
        },
        select: {
          id: true,
          examTrackId: true,
        },
      });

      if (!subject) {
        throw new BadRequestException({
          code: 'PRACTICE_SUBJECT_INVALID',
          message: 'Subject was not found for this site.',
        });
      }

      if (resolvedExamTrackId && resolvedExamTrackId !== subject.examTrackId) {
        throw new BadRequestException({
          code: 'PRACTICE_SCOPE_MISMATCH',
          message: 'Subject does not belong to the selected exam track.',
        });
      }

      resolvedSubjectId = subject.id;
      resolvedExamTrackId = subject.examTrackId;
    }

    if (input.topicId) {
      const topic = await this.prisma.topic.findFirst({
        where: {
          id: input.topicId,
          siteId,
          isActive: true,
          visibility: {
            not: CatalogVisibility.INTERNAL,
          },
        },
        select: {
          id: true,
          subjectId: true,
          subject: {
            select: {
              examTrackId: true,
            },
          },
        },
      });

      if (!topic) {
        throw new BadRequestException({
          code: 'PRACTICE_TOPIC_INVALID',
          message: 'Topic was not found for this site.',
        });
      }

      if (resolvedSubjectId && resolvedSubjectId !== topic.subjectId) {
        throw new BadRequestException({
          code: 'PRACTICE_SCOPE_MISMATCH',
          message: 'Topic does not belong to the selected subject.',
        });
      }

      if (
        resolvedExamTrackId &&
        resolvedExamTrackId !== topic.subject.examTrackId
      ) {
        throw new BadRequestException({
          code: 'PRACTICE_SCOPE_MISMATCH',
          message: 'Topic does not belong to the selected exam track.',
        });
      }

      resolvedTopicId = topic.id;
      resolvedSubjectId = topic.subjectId;
      resolvedExamTrackId = topic.subject.examTrackId;
    }

    return {
      mode: input.mode,
      examTrackId: resolvedExamTrackId,
      mediumId: input.mediumId ?? null,
      subjectId: resolvedSubjectId,
      topicId: resolvedTopicId,
      difficulty: input.difficulty ?? null,
    };
  }

  private buildQuestionScopeWhere(siteId: string, scope: PracticeScope) {
    const and: Prisma.QuestionWhereInput[] = [
      {
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
      {
        OR: [{ mediumId: null }, { medium: { isActive: true } }],
      },
      {
        OR: [{ topicId: null }, { topic: { isActive: true } }],
      },
    ];
    if (scope.mediumId) {
      and.push({
        OR: [{ mediumId: scope.mediumId }, { mediumId: null }],
      });
    }

    return {
      siteId,
      status: QuestionStatus.PUBLISHED,
      subjectId: scope.subjectId ?? undefined,
      topicId: scope.topicId ?? undefined,
      difficulty: scope.difficulty ?? undefined,
      subject: {
        isActive: true,
        examTrack: {
          isActive: true,
        },
        ...(scope.examTrackId ? { examTrackId: scope.examTrackId } : {}),
      },
      AND: and,
    } satisfies Prisma.QuestionWhereInput;
  }

  private async getOwnedSessionSummary(
    user: AuthenticatedUser,
    sessionId: string,
  ) {
    const session = await this.prisma.practiceSession.findFirst({
      where: {
        id: sessionId,
        siteId: user.siteId,
        userId: user.userId,
      },
      select: practiceSessionSummarySelect,
    });

    if (!session) {
      throw new NotFoundException({
        code: 'PRACTICE_SESSION_NOT_FOUND',
        message: 'Practice session was not found.',
      });
    }

    return session;
  }

  private assertActiveSession(session: PracticeSessionSummaryRecord) {
    if (session.status !== PracticeSessionStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'PRACTICE_SESSION_NOT_ACTIVE',
        message: 'The practice session is no longer active.',
      });
    }
  }

  private async getOwnedSessionQuestion(
    user: AuthenticatedUser,
    sessionId: string,
    questionId: string,
  ) {
    const sessionQuestion = await this.prisma.practiceSessionQuestion.findFirst(
      {
        where: {
          siteId: user.siteId,
          userId: user.userId,
          practiceSessionId: sessionId,
          questionId,
        },
        select: {
          ...practiceSessionQuestionSelect,
          practiceSession: {
            select: practiceSessionSummarySelect,
          },
        },
      },
    );

    if (!sessionQuestion) {
      throw new NotFoundException({
        code: 'PRACTICE_SESSION_QUESTION_NOT_FOUND',
        message: 'The question is not part of this practice session.',
      });
    }

    return sessionQuestion as SessionQuestionMutationRecord;
  }

  private async selectQuestionsForSession(
    siteId: string,
    userId: string,
    session: PracticeSessionSummaryRecord,
    excludedQuestionIds: string[],
    take: number,
  ) {
    const scope = {
      mode: session.mode,
      examTrackId: session.examTrackId,
      mediumId: session.mediumId,
      subjectId: session.subjectId,
      topicId: session.topicId,
      difficulty: session.difficulty,
    } satisfies PracticeScope;
    const baseWhere = this.buildQuestionScopeWhere(siteId, scope);
    const items: QuestionRecord[] = [];
    const seenIds = new Set(excludedQuestionIds);

    const appendQuestions = (questions: QuestionRecord[]) => {
      for (const question of questions) {
        if (seenIds.has(question.id)) {
          continue;
        }

        seenIds.add(question.id);
        items.push(question);
        if (items.length >= take) {
          break;
        }
      }
    };

    appendQuestions(
      await this.prisma.question.findMany({
        where: {
          ...baseWhere,
          id: {
            notIn: Array.from(seenIds),
          },
          practiceStates: {
            none: {
              userId,
            },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        select: questionSelect,
      }),
    );

    if (items.length < take) {
      const wrongStates = await this.prisma.userQuestionPracticeState.findMany({
        where: {
          siteId,
          userId,
          wrongCount: {
            gt: 0,
          },
          questionId: {
            notIn: Array.from(seenIds),
          },
          question: {
            is: baseWhere,
          },
        },
        orderBy: [
          { wrongCount: 'desc' },
          { lastAnsweredAt: 'asc' },
          { updatedAt: 'asc' },
        ],
        take: take - items.length,
        select: {
          question: {
            select: questionSelect,
          },
        },
      });

      appendQuestions(wrongStates.map((state) => state.question));
    }

    if (items.length < take) {
      const pendingStates =
        await this.prisma.userQuestionPracticeState.findMany({
          where: {
            siteId,
            userId,
            answerCount: 0,
            questionId: {
              notIn: Array.from(seenIds),
            },
            question: {
              is: baseWhere,
            },
          },
          orderBy: [{ lastServedAt: 'asc' }, { updatedAt: 'asc' }],
          take: take - items.length,
          select: {
            question: {
              select: questionSelect,
            },
          },
        });

      appendQuestions(pendingStates.map((state) => state.question));
    }

    if (items.length < take) {
      const leastRecentStates =
        await this.prisma.userQuestionPracticeState.findMany({
          where: {
            siteId,
            userId,
            answerCount: {
              gt: 0,
            },
            questionId: {
              notIn: Array.from(seenIds),
            },
            question: {
              is: baseWhere,
            },
          },
          orderBy: [{ lastAnsweredAt: 'asc' }, { updatedAt: 'asc' }],
          take: take - items.length,
          select: {
            question: {
              select: questionSelect,
            },
          },
        });

      appendQuestions(leastRecentStates.map((state) => state.question));
    }

    return items.slice(0, take);
  }

  private async incrementServedProgress(
    tx: Prisma.TransactionClient,
    siteId: string,
    userId: string,
    questions: QuestionRecord[],
    now: Date,
  ) {
    const subjectCounts = new Map<string, number>();
    const topicCounts = new Map<string, { subjectId: string; count: number }>();

    for (const question of questions) {
      subjectCounts.set(
        question.subjectId,
        (subjectCounts.get(question.subjectId) ?? 0) + 1,
      );

      if (question.topicId) {
        const current = topicCounts.get(question.topicId);
        topicCounts.set(question.topicId, {
          subjectId: question.subjectId,
          count: (current?.count ?? 0) + 1,
        });
      }
    }

    for (const [subjectId, count] of subjectCounts.entries()) {
      await tx.userSubjectPracticeProgress.upsert({
        where: {
          subjectId_userId: {
            subjectId,
            userId,
          },
        },
        update: {
          servedCount: {
            increment: count,
          },
          lastPracticedAt: now,
          siteId,
        },
        create: {
          siteId,
          userId,
          subjectId,
          servedCount: count,
          lastPracticedAt: now,
        },
      });
    }

    for (const [topicId, payload] of topicCounts.entries()) {
      await tx.userTopicPracticeProgress.upsert({
        where: {
          topicId_userId: {
            topicId,
            userId,
          },
        },
        update: {
          servedCount: {
            increment: payload.count,
          },
          lastPracticedAt: now,
          siteId,
          subjectId: payload.subjectId,
        },
        create: {
          siteId,
          userId,
          subjectId: payload.subjectId,
          topicId,
          servedCount: payload.count,
          lastPracticedAt: now,
        },
      });
    }
  }

  private async incrementAnsweredProgress(
    tx: Prisma.TransactionClient,
    siteId: string,
    userId: string,
    question: QuestionRecord,
    isCorrect: boolean,
    now: Date,
  ) {
    const subjectProgress = await tx.userSubjectPracticeProgress.upsert({
      where: {
        subjectId_userId: {
          subjectId: question.subjectId,
          userId,
        },
      },
      update: {
        answeredCount: {
          increment: 1,
        },
        correctCount: {
          increment: isCorrect ? 1 : 0,
        },
        wrongCount: {
          increment: isCorrect ? 0 : 1,
        },
        lastPracticedAt: now,
        siteId,
      },
      create: {
        siteId,
        userId,
        subjectId: question.subjectId,
        answeredCount: 1,
        correctCount: isCorrect ? 1 : 0,
        wrongCount: isCorrect ? 0 : 1,
        accuracyPercent: isCorrect ? 100 : 0,
        lastPracticedAt: now,
      },
    });

    await tx.userSubjectPracticeProgress.update({
      where: {
        subjectId_userId: {
          subjectId: question.subjectId,
          userId,
        },
      },
      data: {
        accuracyPercent: calculateAccuracyPercent(
          subjectProgress.correctCount,
          subjectProgress.answeredCount,
        ),
      },
    });

    if (!question.topicId) {
      return;
    }

    const topicProgress = await tx.userTopicPracticeProgress.upsert({
      where: {
        topicId_userId: {
          topicId: question.topicId,
          userId,
        },
      },
      update: {
        answeredCount: {
          increment: 1,
        },
        correctCount: {
          increment: isCorrect ? 1 : 0,
        },
        wrongCount: {
          increment: isCorrect ? 0 : 1,
        },
        subjectId: question.subjectId,
        siteId,
        lastPracticedAt: now,
      },
      create: {
        siteId,
        userId,
        subjectId: question.subjectId,
        topicId: question.topicId,
        answeredCount: 1,
        correctCount: isCorrect ? 1 : 0,
        wrongCount: isCorrect ? 0 : 1,
        accuracyPercent: isCorrect ? 100 : 0,
        lastPracticedAt: now,
      },
    });

    await tx.userTopicPracticeProgress.update({
      where: {
        topicId_userId: {
          topicId: question.topicId,
          userId,
        },
      },
      data: {
        accuracyPercent: calculateAccuracyPercent(
          topicProgress.correctCount,
          topicProgress.answeredCount,
        ),
      },
    });
  }

  private async incrementRevealProgress(
    tx: Prisma.TransactionClient,
    siteId: string,
    userId: string,
    question: QuestionRecord,
    now: Date,
  ) {
    await tx.userSubjectPracticeProgress.upsert({
      where: {
        subjectId_userId: {
          subjectId: question.subjectId,
          userId,
        },
      },
      update: {
        revealCount: {
          increment: 1,
        },
        lastPracticedAt: now,
        siteId,
      },
      create: {
        siteId,
        userId,
        subjectId: question.subjectId,
        revealCount: 1,
        lastPracticedAt: now,
      },
    });

    if (!question.topicId) {
      return;
    }

    await tx.userTopicPracticeProgress.upsert({
      where: {
        topicId_userId: {
          topicId: question.topicId,
          userId,
        },
      },
      update: {
        revealCount: {
          increment: 1,
        },
        subjectId: question.subjectId,
        siteId,
        lastPracticedAt: now,
      },
      create: {
        siteId,
        userId,
        subjectId: question.subjectId,
        topicId: question.topicId,
        revealCount: 1,
        lastPracticedAt: now,
      },
    });
  }

  private ensureAnswerRecord(answerJson: Record<string, unknown>) {
    if (
      !answerJson ||
      typeof answerJson !== 'object' ||
      Array.isArray(answerJson)
    ) {
      throw new BadRequestException({
        code: 'PRACTICE_ANSWER_INVALID',
        message: 'Answer payload must be an object.',
      });
    }

    return answerJson;
  }

  private normalizeFinalAnswer(
    questionType: QuestionType,
    answerJson: Record<string, unknown>,
  ) {
    const input = this.ensureAnswerRecord(answerJson);

    if (questionType === QuestionType.TEXT_INPUT) {
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (!text) {
        throw new BadRequestException({
          code: 'PRACTICE_ANSWER_INVALID',
          message: 'Text-input answers require a non-empty text value.',
        });
      }

      return {
        text,
      };
    }

    const rawOptionKeys = Array.isArray(input.optionKeys)
      ? input.optionKeys.filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0,
        )
      : [];
    const optionKeys = normalizeOptionKeys(rawOptionKeys);

    if (optionKeys.length === 0) {
      throw new BadRequestException({
        code: 'PRACTICE_ANSWER_INVALID',
        message: 'Choice questions require one or more option keys.',
      });
    }

    if (
      questionType === QuestionType.SINGLE_CHOICE &&
      optionKeys.length !== 1
    ) {
      throw new BadRequestException({
        code: 'PRACTICE_ANSWER_INVALID',
        message: 'Single-choice questions require exactly one option key.',
      });
    }

    return {
      optionKeys,
    };
  }

  private evaluateAnswer(
    question: QuestionRecord,
    answerJson: Record<string, unknown>,
  ) {
    const correctAnswerJson = question.correctAnswerJson as Record<
      string,
      unknown
    >;

    if (question.type === QuestionType.TEXT_INPUT) {
      const acceptedAnswers = Array.isArray(correctAnswerJson.acceptedAnswers)
        ? correctAnswerJson.acceptedAnswers.filter(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0,
          )
        : [];

      return acceptedAnswers
        .map((item) => normalizeAnswerText(item))
        .includes(normalizeAnswerText(String(answerJson.text ?? '')));
    }

    const correctOptionKeys = normalizeOptionKeys(
      Array.isArray(correctAnswerJson.optionKeys)
        ? correctAnswerJson.optionKeys.filter(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0,
          )
        : [],
    );
    const selectedOptionKeys = normalizeOptionKeys(
      Array.isArray(answerJson.optionKeys)
        ? answerJson.optionKeys.filter(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0,
          )
        : [],
    );

    return (
      correctOptionKeys.length === selectedOptionKeys.length &&
      correctOptionKeys.every(
        (value, index) => value === selectedOptionKeys[index],
      )
    );
  }

  private getTotalAvailableQuestions(configJson: Prisma.JsonValue | null) {
    if (
      !configJson ||
      typeof configJson !== 'object' ||
      Array.isArray(configJson)
    ) {
      return null;
    }

    const selection = (configJson as Record<string, unknown>).selection;
    if (
      !selection ||
      typeof selection !== 'object' ||
      Array.isArray(selection)
    ) {
      return null;
    }

    const total = (selection as Record<string, unknown>)
      .totalAvailableQuestions;
    return typeof total === 'number' && Number.isInteger(total) ? total : null;
  }
}
