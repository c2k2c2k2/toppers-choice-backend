import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogVisibility,
  Prisma,
  QuestionDifficulty,
  QuestionStatus,
  QuestionType,
  TestAccessType,
  TestAttemptStatus,
  TestFamily,
  TestStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  mapStudentQuestionDetail,
  questionSelect,
  type QuestionRecord,
} from '../questions/questions.types';
import type {
  CreateTestDto,
  GenerateTestQuestionsDto,
  ListAdminTestsQueryDto,
  ListPublishedTestsQueryDto,
  ListTestAttemptsQueryDto,
  SaveTestAttemptAnswerDto,
  TestQuestionInputDto,
  UpdateTestDto,
} from './dto/manage-tests.dto';
import {
  getAdminTestAccessSummary,
  getFreeTestAccessSummary,
  getPremiumTestAccessSummary,
  mapAdminTestDetail,
  mapStudentTestDetail,
  mapTestAttemptDetail,
  mapTestAttemptSummary,
  mapTestSummary,
  testAttemptDetailSelect,
  testAttemptSummarySelect,
  testDetailSelect,
  testSummarySelect,
  type TestAttemptDetailRecord,
  type TestSummaryRecord,
} from './tests.types';
import { TestsEntitlementService } from './tests.entitlement.service';
import {
  calculatePercentage,
  normalizeAnswerText,
  normalizeOptionKeys,
  normalizeOptionalText,
  shuffleArray,
  slugifyTestValue,
} from './tests.utils';

type NormalizedTestQuestionInput = {
  questionId: string;
  orderIndex: number;
  positiveMarks: number;
  negativeMarks: number;
};

type ResolvedTestScope = {
  family: TestFamily;
  examTrackId: string | null;
  mediumId: string | null;
  subjectId: string | null;
};

type NormalizedGenerationRule = {
  label: string | null;
  subjectId: string | null;
  topicIds: string[];
  difficulty: QuestionDifficulty | null;
  type: QuestionType | null;
  questionCount: number;
  positiveMarks: number;
  negativeMarks: number;
};

type AttemptQuestionScore = {
  questionId: string;
  questionCodeSnapshot: string | null;
  questionTypeSnapshot: QuestionType;
  difficultySnapshot: string;
  subjectIdSnapshot: string;
  topicIdSnapshot: string | null;
  questionSnapshot: Record<string, unknown>;
  positiveMarks: number;
  negativeMarks: number;
  finalAnswerJson: Record<string, unknown> | null;
  awardedMarks: number;
  isCorrect: boolean | null;
  answered: boolean;
};

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly testsEntitlementService: TestsEntitlementService,
  ) {}

  async listAdminTests(siteId: string, query: ListAdminTestsQueryDto) {
    const where = this.buildAdminTestsWhere(siteId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: testSummarySelect,
      }),
      this.prisma.test.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        mapTestSummary(item, getAdminTestAccessSummary()),
      ),
      total,
    };
  }

  async getAdminTest(siteId: string, testId: string) {
    const test = await this.prisma.test.findFirst({
      where: {
        id: testId,
        siteId,
      },
      select: testDetailSelect,
    });

    if (!test) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Test was not found.',
      });
    }

    return mapAdminTestDetail(test);
  }

  async createTest(user: AuthenticatedUser, input: CreateTestDto) {
    const scope = await this.resolveTestScope(user.siteId, input);
    const questions = this.normalizeTestQuestionInputs(input.questions ?? []);
    const sourceQuestions = await this.loadSourceQuestions(
      user.siteId,
      questions.map((item) => item.questionId),
    );

    this.validateQuestionsAgainstScope(scope, sourceQuestions);
    this.validateAvailabilityWindow(input.availableFrom, input.availableUntil);

    const created = await this.prisma.$transaction(async (tx) => {
      const test = await tx.test.create({
        data: {
          siteId: user.siteId,
          code: input.code ?? null,
          slug: this.buildTestSlug(input.slug, input.title),
          title: input.title.trim(),
          shortDescription: input.shortDescription?.trim() ?? null,
          instructionsJson:
            input.instructionsJson === undefined
              ? Prisma.DbNull
              : (input.instructionsJson as Prisma.InputJsonValue),
          configJson:
            input.configJson === undefined
              ? Prisma.DbNull
              : (input.configJson as Prisma.InputJsonValue),
          family: scope.family,
          accessType: input.accessType ?? TestAccessType.FREE,
          examTrackId: scope.examTrackId,
          mediumId: scope.mediumId,
          subjectId: scope.subjectId,
          durationMinutes: input.durationMinutes,
          maxAttempts: input.maxAttempts ?? 1,
          randomizeQuestionOrder: input.randomizeQuestionOrder ?? false,
          availableFrom: input.availableFrom
            ? new Date(input.availableFrom)
            : null,
          availableUntil: input.availableUntil
            ? new Date(input.availableUntil)
            : null,
          createdByUserId: user.userId,
          updatedByUserId: user.userId,
        },
        select: {
          id: true,
        },
      });

      await this.syncTestQuestions(tx, user.siteId, test.id, questions);
      await this.refreshTestMetrics(tx, test.id, user.userId);

      return test.id;
    });

    return this.getAdminTest(user.siteId, created);
  }

  async updateTest(
    user: AuthenticatedUser,
    testId: string,
    input: UpdateTestDto,
  ) {
    const existing = await this.prisma.test.findFirst({
      where: {
        id: testId,
        siteId: user.siteId,
      },
      select: testDetailSelect,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Test was not found.',
      });
    }

    const nextScope = await this.resolveTestScope(user.siteId, {
      family: input.family ?? existing.family,
      examTrackId:
        input.examTrackId === undefined
          ? (existing.examTrackId ?? undefined)
          : input.examTrackId,
      mediumId:
        input.mediumId === undefined
          ? (existing.mediumId ?? undefined)
          : input.mediumId,
      subjectId:
        input.subjectId === undefined
          ? (existing.subjectId ?? undefined)
          : input.subjectId,
    });
    const questions =
      input.questions === undefined
        ? existing.questions.map((item) => ({
            questionId: item.questionId,
            orderIndex: item.orderIndex,
            positiveMarks: item.positiveMarks,
            negativeMarks: item.negativeMarks,
          }))
        : this.normalizeTestQuestionInputs(input.questions);
    const sourceQuestions = await this.loadSourceQuestions(
      user.siteId,
      questions.map((item) => item.questionId),
    );

    this.validateQuestionsAgainstScope(nextScope, sourceQuestions);
    this.validateAvailabilityWindow(
      input.availableFrom ??
        (existing.availableFrom
          ? existing.availableFrom.toISOString()
          : undefined),
      input.availableUntil ??
        (existing.availableUntil
          ? existing.availableUntil.toISOString()
          : undefined),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.test.update({
        where: {
          id: testId,
        },
        data: {
          code: input.code === undefined ? undefined : (input.code ?? null),
          slug:
            input.slug === undefined && input.title === undefined
              ? undefined
              : this.buildTestSlug(
                  input.slug ?? existing.slug,
                  input.title ?? existing.title,
                ),
          title: input.title?.trim(),
          shortDescription:
            input.shortDescription === undefined
              ? undefined
              : (input.shortDescription?.trim() ?? null),
          instructionsJson:
            input.instructionsJson === undefined
              ? undefined
              : input.instructionsJson === null
                ? Prisma.DbNull
                : (input.instructionsJson as Prisma.InputJsonValue),
          configJson:
            input.configJson === undefined
              ? undefined
              : input.configJson === null
                ? Prisma.DbNull
                : (input.configJson as Prisma.InputJsonValue),
          family: nextScope.family,
          accessType: input.accessType,
          examTrackId:
            input.examTrackId === undefined ? undefined : nextScope.examTrackId,
          mediumId:
            input.mediumId === undefined ? undefined : nextScope.mediumId,
          subjectId:
            input.subjectId === undefined ? undefined : nextScope.subjectId,
          durationMinutes: input.durationMinutes,
          maxAttempts: input.maxAttempts,
          randomizeQuestionOrder: input.randomizeQuestionOrder,
          availableFrom:
            input.availableFrom === undefined
              ? undefined
              : input.availableFrom
                ? new Date(input.availableFrom)
                : null,
          availableUntil:
            input.availableUntil === undefined
              ? undefined
              : input.availableUntil
                ? new Date(input.availableUntil)
                : null,
          updatedByUserId: user.userId,
        },
      });

      if (input.questions !== undefined) {
        await this.syncTestQuestions(tx, user.siteId, testId, questions);
      }

      await this.refreshTestMetrics(tx, testId, user.userId);
    });

    return this.getAdminTest(user.siteId, testId);
  }

  async generateTestQuestions(
    user: AuthenticatedUser,
    testId: string,
    input: GenerateTestQuestionsDto,
  ) {
    const existing = await this.prisma.test.findFirst({
      where: {
        id: testId,
        siteId: user.siteId,
      },
      select: testDetailSelect,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Test was not found.',
      });
    }

    if (existing.status !== TestStatus.DRAFT) {
      throw new BadRequestException({
        code: 'TEST_GENERATION_REQUIRES_DRAFT',
        message: 'Questions can be generated only for draft tests.',
      });
    }

    const scope = await this.resolveTestScope(user.siteId, {
      family: existing.family,
      examTrackId: existing.examTrackId ?? undefined,
      mediumId: existing.mediumId ?? undefined,
      subjectId: existing.subjectId ?? undefined,
    });
    const replaceExisting = input.replaceExisting ?? true;
    const randomize = input.randomize ?? true;
    const rules = this.normalizeGenerationRules(input, existing.subjectId);
    const usedQuestionIds = new Set<string>(
      replaceExisting
        ? []
        : existing.questions.map((question) => question.questionId),
    );
    const generatedQuestions: NormalizedTestQuestionInput[] = replaceExisting
      ? []
      : existing.questions.map((question) => ({
          questionId: question.questionId,
          orderIndex: question.orderIndex,
          positiveMarks: question.positiveMarks,
          negativeMarks: question.negativeMarks,
        }));

    for (const rule of rules) {
      const candidates = await this.loadGenerationCandidates(
        user.siteId,
        scope,
        rule,
        usedQuestionIds,
      );
      const selected = (
        randomize ? shuffleArray(candidates) : candidates
      ).slice(0, rule.questionCount);

      if (selected.length < rule.questionCount) {
        throw new BadRequestException({
          code: 'TEST_GENERATION_POOL_TOO_SMALL',
          message: `Only ${selected.length} published questions matched ${rule.label ?? 'one generator rule'}, but ${rule.questionCount} were requested.`,
        });
      }

      for (const question of selected) {
        usedQuestionIds.add(question.id);
        generatedQuestions.push({
          questionId: question.id,
          orderIndex: generatedQuestions.length + 1,
          positiveMarks: rule.positiveMarks,
          negativeMarks: rule.negativeMarks,
        });
      }
    }

    const sourceQuestions = await this.loadSourceQuestions(
      user.siteId,
      generatedQuestions.map((question) => question.questionId),
    );
    this.validateQuestionsAgainstScope(scope, sourceQuestions);

    const existingConfig =
      existing.configJson &&
      typeof existing.configJson === 'object' &&
      !Array.isArray(existing.configJson)
        ? (existing.configJson as Record<string, unknown>)
        : {};

    await this.prisma.$transaction(async (tx) => {
      await this.syncTestQuestions(tx, user.siteId, testId, generatedQuestions);
      await tx.test.update({
        where: {
          id: testId,
        },
        data: {
          configJson: {
            ...existingConfig,
            generatedQuestionBlueprint: {
              generatedAt: new Date().toISOString(),
              replaceExisting,
              randomize,
              sections: rules.map((rule) => ({
                label: rule.label,
                subjectId: rule.subjectId,
                topicIds: rule.topicIds,
                difficulty: rule.difficulty,
                type: rule.type,
                questionCount: rule.questionCount,
                positiveMarks: rule.positiveMarks,
                negativeMarks: rule.negativeMarks,
              })),
            },
          } as Prisma.InputJsonValue,
          updatedByUserId: user.userId,
        },
      });
      await this.refreshTestMetrics(tx, testId, user.userId);
    });

    return this.getAdminTest(user.siteId, testId);
  }

  async publishTest(user: AuthenticatedUser, testId: string) {
    const test = await this.prisma.test.findFirst({
      where: {
        id: testId,
        siteId: user.siteId,
      },
      select: testDetailSelect,
    });

    if (!test) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Test was not found.',
      });
    }

    await this.assertPublishableTest(user.siteId, test);

    await this.prisma.test.update({
      where: {
        id: testId,
      },
      data: {
        status: TestStatus.PUBLISHED,
        archivedAt: null,
        publishedAt: new Date(),
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminTest(user.siteId, testId);
  }

  async unpublishTest(user: AuthenticatedUser, testId: string) {
    const existing = await this.prisma.test.findFirst({
      where: {
        id: testId,
        siteId: user.siteId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Test was not found.',
      });
    }

    await this.prisma.test.update({
      where: {
        id: testId,
      },
      data: {
        status: TestStatus.DRAFT,
        publishedAt: null,
        publishedByUserId: null,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminTest(user.siteId, testId);
  }

  async listPublishedTests(
    user: AuthenticatedUser,
    query: ListPublishedTestsQueryDto,
  ) {
    await this.finalizeExpiredAttempts(user.siteId, user.userId);

    const where = this.buildPublishedTestsWhere(user.siteId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.test.findMany({
        where,
        orderBy: [
          { availableFrom: 'asc' },
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: testSummarySelect,
      }),
      this.prisma.test.count({ where }),
    ]);

    return {
      items: await Promise.all(
        items.map(async (item) =>
          mapTestSummary(item, await this.resolveTestAccessSummary(user, item)),
        ),
      ),
      total,
    };
  }

  async getPublishedTest(user: AuthenticatedUser, testId: string) {
    const test = await this.prisma.test.findFirst({
      where: {
        id: testId,
        ...this.buildPublishedTestsWhere(user.siteId, {}),
      },
      select: testSummarySelect,
    });

    if (!test) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Published test was not found.',
      });
    }

    return mapStudentTestDetail(
      test,
      await this.resolveTestAccessSummary(user, test),
    );
  }

  async startAttempt(user: AuthenticatedUser, testId: string) {
    this.assertStudentUser(user);
    await this.finalizeExpiredAttempts(user.siteId, user.userId, testId);

    const test = await this.prisma.test.findFirst({
      where: {
        id: testId,
        ...this.buildPublishedTestsWhere(user.siteId, {}),
      },
      select: {
        ...testDetailSelect,
        questions: {
          orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            questionId: true,
            orderIndex: true,
            positiveMarks: true,
            negativeMarks: true,
            question: {
              select: questionSelect,
            },
          },
        },
      },
    });

    if (!test) {
      throw new NotFoundException({
        code: 'TEST_NOT_FOUND',
        message: 'Published test was not found.',
      });
    }

    const access = await this.testsEntitlementService.canAccessTest(
      user.siteId,
      user.userId,
      {
        id: test.id,
        accessType: test.accessType,
        family: test.family,
        examTrackId: test.examTrackId,
        mediumId: test.mediumId,
        subjectId: test.subjectId,
      },
    );
    if (!access.allowed) {
      throw new ForbiddenException({
        code: 'TEST_ACCESS_DENIED',
        message: access.reason ?? 'You cannot access this test right now.',
      });
    }

    const activeAttempt = await this.prisma.testAttempt.findFirst({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        testId: test.id,
        status: TestAttemptStatus.ACTIVE,
      },
      orderBy: [{ startedAt: 'desc' }],
      select: testAttemptSummarySelect,
    });

    if (activeAttempt) {
      throw new ConflictException({
        code: 'TEST_ACTIVE_ATTEMPT_EXISTS',
        message: 'You already have an active attempt for this test.',
      });
    }

    const attemptCount = await this.prisma.testAttempt.count({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        testId: test.id,
      },
    });

    if (attemptCount >= test.maxAttempts) {
      throw new ForbiddenException({
        code: 'TEST_MAX_ATTEMPTS_REACHED',
        message: 'You have already used the allowed attempts for this test.',
      });
    }

    if (test.questions.length === 0) {
      throw new BadRequestException({
        code: 'TEST_HAS_NO_QUESTIONS',
        message: 'This test does not have any questions configured.',
      });
    }

    for (const item of test.questions) {
      if (item.question.status !== QuestionStatus.PUBLISHED) {
        throw new BadRequestException({
          code: 'TEST_QUESTION_NOT_PUBLISHED',
          message:
            'One or more test questions are no longer published and the attempt cannot be started.',
        });
      }
    }

    const questionEntries = test.randomizeQuestionOrder
      ? shuffleArray(test.questions)
      : [...test.questions];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + test.durationMinutes * 60_000);
    const snapshot = this.buildTestSnapshot(test);

    const created = await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.testAttempt.create({
        data: {
          siteId: user.siteId,
          testId: test.id,
          userId: user.userId,
          authSessionId: user.sessionId,
          attemptNumber: attemptCount + 1,
          testSnapshotJson: this.toJson(snapshot),
          durationMinutes: test.durationMinutes,
          questionCount: questionEntries.length,
          maxScore: test.maxScore,
          startedAt: now,
          expiresAt,
        },
        select: {
          id: true,
        },
      });

      for (const [index, entry] of questionEntries.entries()) {
        await tx.testAttemptQuestion.create({
          data: {
            siteId: user.siteId,
            testAttemptId: attempt.id,
            testId: test.id,
            questionId: entry.questionId,
            orderIndex: index,
            questionCodeSnapshot: entry.question.code,
            questionTypeSnapshot: entry.question.type,
            difficultySnapshot: entry.question.difficulty,
            examTrackIdSnapshot: entry.question.subject.examTrackId,
            mediumIdSnapshot: entry.question.mediumId,
            subjectIdSnapshot: entry.question.subjectId,
            topicIdSnapshot: entry.question.topicId,
            positiveMarks: entry.positiveMarks,
            negativeMarks: entry.negativeMarks,
            questionSnapshotJson: this.toJson(
              this.buildAttemptQuestionSnapshot(entry.question),
            ),
            correctAnswerJson: this.toJson(
              entry.question.correctAnswerJson as Record<string, unknown>,
            ),
            explanationJson:
              entry.question.explanationJson === null
                ? Prisma.DbNull
                : this.toJson(
                    entry.question.explanationJson as Record<string, unknown>,
                  ),
          },
        });
      }

      return attempt.id;
    });

    return this.getAttempt(user, created);
  }

  async listAttempts(user: AuthenticatedUser, query: ListTestAttemptsQueryDto) {
    this.assertStudentUser(user);
    await this.finalizeExpiredAttempts(user.siteId, user.userId, query.testId);

    const take = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const where: Prisma.TestAttemptWhereInput = {
      siteId: user.siteId,
      userId: user.userId,
      testId: query.testId,
      status: query.status,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.testAttempt.findMany({
        where,
        orderBy: [{ startedAt: 'desc' }],
        take,
        select: testAttemptSummarySelect,
      }),
      this.prisma.testAttempt.count({ where }),
    ]);

    return {
      items: items.map((item) => mapTestAttemptSummary(item)),
      total,
    };
  }

  async getAttempt(user: AuthenticatedUser, attemptId: string) {
    this.assertStudentUser(user);
    const attempt = await this.getOwnedAttempt(attemptId, user);
    const resolved = await this.finalizeAttemptIfExpired(attempt);

    return mapTestAttemptDetail(resolved);
  }

  async saveAttemptAnswer(
    user: AuthenticatedUser,
    attemptId: string,
    input: SaveTestAttemptAnswerDto,
  ) {
    this.assertStudentUser(user);
    const attempt = await this.getOwnedAttempt(attemptId, user);
    const resolvedAttempt = await this.finalizeAttemptIfExpired(attempt);

    if (resolvedAttempt.status !== TestAttemptStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'TEST_ATTEMPT_NOT_ACTIVE',
        message: 'This test attempt is no longer active.',
      });
    }

    const attemptQuestion = resolvedAttempt.questions.find(
      (item) => item.questionId === input.questionId,
    );

    if (!attemptQuestion) {
      throw new NotFoundException({
        code: 'TEST_ATTEMPT_QUESTION_NOT_FOUND',
        message: 'Question was not found in this attempt.',
      });
    }

    const answerJson = this.normalizeAttemptAnswer(
      attemptQuestion.questionTypeSnapshot,
      input.answerJson,
    );
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.testAttemptQuestion.update({
        where: {
          id: attemptQuestion.id,
        },
        data: {
          latestSavedAnswerJson: this.toJson(answerJson),
          lastSavedAt: now,
        },
      });

      await tx.testAttempt.update({
        where: {
          id: resolvedAttempt.id,
        },
        data: {
          lastSavedAt: now,
        },
      });
    });

    const latest = await this.getOwnedAttemptSummary(attemptId, user);

    return {
      questionId: input.questionId,
      answerJson,
      lastSavedAt: now,
      attempt: mapTestAttemptSummary(latest),
    };
  }

  async submitAttempt(user: AuthenticatedUser, attemptId: string) {
    this.assertStudentUser(user);
    const attempt = await this.getOwnedAttempt(attemptId, user);

    if (attempt.status !== TestAttemptStatus.ACTIVE) {
      return mapTestAttemptDetail(attempt);
    }

    const status =
      attempt.expiresAt <= new Date()
        ? TestAttemptStatus.AUTO_SUBMITTED
        : TestAttemptStatus.SUBMITTED;

    const submitted = await this.finalizeAttempt(attemptId, status);
    return mapTestAttemptDetail(submitted);
  }

  private buildAdminTestsWhere(siteId: string, query: ListAdminTestsQueryDto) {
    return {
      siteId,
      family: query.family,
      status: query.status,
      examTrackId: query.examTrackId,
      mediumId: query.mediumId,
      subjectId: query.subjectId,
      OR: query.search
        ? [
            {
              title: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            {
              slug: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
            {
              code: {
                contains: query.search,
                mode: 'insensitive',
              },
            },
          ]
        : undefined,
    } satisfies Prisma.TestWhereInput;
  }

  private buildPublishedTestsWhere(
    siteId: string,
    query: ListPublishedTestsQueryDto,
  ) {
    const now = new Date();

    return {
      siteId,
      family: query.family,
      accessType: query.accessType,
      examTrackId: query.examTrackId,
      mediumId: query.mediumId,
      subjectId: query.subjectId,
      status: TestStatus.PUBLISHED,
      OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
      AND: [
        {
          OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
        },
        {
          OR: [{ availableUntil: null }, { availableUntil: { gte: now } }],
        },
      ],
    } satisfies Prisma.TestWhereInput;
  }

  private async resolveTestScope(
    siteId: string,
    input: {
      family: TestFamily;
      examTrackId?: string;
      mediumId?: string;
      subjectId?: string;
    },
  ): Promise<ResolvedTestScope> {
    if (input.family === TestFamily.SUBJECT_WISE && !input.subjectId) {
      throw new BadRequestException({
        code: 'TEST_SUBJECT_REQUIRED',
        message: 'Subject-wise tests require a subject selection.',
      });
    }

    let resolvedExamTrackId = input.examTrackId ?? null;
    let resolvedSubjectId = input.subjectId ?? null;

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
          code: 'TEST_EXAM_TRACK_INVALID',
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
          code: 'TEST_MEDIUM_INVALID',
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
          code: 'TEST_SUBJECT_INVALID',
          message: 'Subject was not found for this site.',
        });
      }

      if (resolvedExamTrackId && resolvedExamTrackId !== subject.examTrackId) {
        throw new BadRequestException({
          code: 'TEST_SCOPE_MISMATCH',
          message: 'Subject does not belong to the selected exam track.',
        });
      }

      resolvedExamTrackId = subject.examTrackId;
      resolvedSubjectId = subject.id;
    }

    return {
      family: input.family,
      examTrackId: resolvedExamTrackId,
      mediumId: input.mediumId ?? null,
      subjectId: resolvedSubjectId,
    };
  }

  private async resolveTestAccessSummary(
    user: AuthenticatedUser,
    test: Pick<
      TestSummaryRecord,
      'id' | 'accessType' | 'family' | 'examTrackId' | 'mediumId' | 'subjectId'
    >,
  ) {
    if (user.userType === UserType.ADMIN) {
      return getAdminTestAccessSummary();
    }

    if (test.accessType === TestAccessType.FREE) {
      return getFreeTestAccessSummary();
    }

    const access = await this.testsEntitlementService.canAccessTest(
      user.siteId,
      user.userId,
      {
        id: test.id,
        accessType: test.accessType,
        family: test.family,
        examTrackId: test.examTrackId,
        mediumId: test.mediumId,
        subjectId: test.subjectId,
      },
    );

    return getPremiumTestAccessSummary(access.allowed, access.reason);
  }

  private normalizeTestQuestionInputs(inputs: TestQuestionInputDto[]) {
    return inputs
      .map((item, index) => ({
        questionId: item.questionId,
        orderIndex: item.orderIndex ?? index,
        positiveMarks: item.positiveMarks ?? 1,
        negativeMarks: item.negativeMarks ?? 0,
      }))
      .sort((left, right) => left.orderIndex - right.orderIndex);
  }

  private async loadSourceQuestions(siteId: string, questionIds: string[]) {
    const questions = await this.prisma.question.findMany({
      where: {
        id: {
          in: questionIds,
        },
        siteId,
      },
      select: questionSelect,
    });

    if (questions.length !== questionIds.length) {
      throw new BadRequestException({
        code: 'TEST_QUESTION_NOT_FOUND',
        message: 'One or more test questions were not found for this site.',
      });
    }

    return new Map(questions.map((item) => [item.id, item]));
  }

  private validateQuestionsAgainstScope(
    scope: ResolvedTestScope,
    sourceQuestions: Map<string, QuestionRecord>,
  ) {
    for (const question of sourceQuestions.values()) {
      if (
        scope.examTrackId &&
        question.subject.examTrackId !== scope.examTrackId
      ) {
        throw new BadRequestException({
          code: 'TEST_QUESTION_SCOPE_INVALID',
          message:
            'A selected question does not belong to the test exam track.',
        });
      }

      if (scope.mediumId && question.mediumId !== scope.mediumId) {
        throw new BadRequestException({
          code: 'TEST_QUESTION_SCOPE_INVALID',
          message: 'A selected question does not belong to the test medium.',
        });
      }

      if (scope.subjectId && question.subjectId !== scope.subjectId) {
        throw new BadRequestException({
          code: 'TEST_QUESTION_SCOPE_INVALID',
          message: 'A selected question does not belong to the test subject.',
        });
      }
    }
  }

  private validateAvailabilityWindow(
    availableFrom?: string | null,
    availableUntil?: string | null,
  ) {
    if (!availableFrom || !availableUntil) {
      return;
    }

    const from = new Date(availableFrom);
    const until = new Date(availableUntil);
    if (until <= from) {
      throw new BadRequestException({
        code: 'TEST_AVAILABILITY_INVALID',
        message: 'Availability end time must be after the start time.',
      });
    }
  }

  private normalizeGenerationRules(
    input: GenerateTestQuestionsDto,
    fallbackSubjectId: string | null,
  ): NormalizedGenerationRule[] {
    const sourceRules =
      input.sections && input.sections.length > 0 ? input.sections : [input];

    return sourceRules.map((rule, index) => {
      const questionCount = rule.questionCount ?? input.questionCount;

      if (!questionCount) {
        throw new BadRequestException({
          code: 'TEST_GENERATION_COUNT_REQUIRED',
          message: 'Each generator rule requires a question count.',
        });
      }

      const topicIds =
        rule.topicIds === undefined
          ? (input.topicIds ?? [])
          : (rule.topicIds ?? []);

      return {
        label: rule.label ?? `Section ${index + 1}`,
        subjectId: rule.subjectId ?? input.subjectId ?? fallbackSubjectId,
        topicIds: Array.from(new Set(topicIds)),
        difficulty: rule.difficulty ?? input.difficulty ?? null,
        type: rule.type ?? input.type ?? null,
        questionCount,
        positiveMarks: rule.positiveMarks ?? input.positiveMarks ?? 1,
        negativeMarks: rule.negativeMarks ?? input.negativeMarks ?? 0,
      };
    });
  }

  private async loadGenerationCandidates(
    siteId: string,
    scope: ResolvedTestScope,
    rule: NormalizedGenerationRule,
    excludedQuestionIds: Set<string>,
  ) {
    const candidates = await this.prisma.question.findMany({
      where: {
        siteId,
        status: QuestionStatus.PUBLISHED,
        id:
          excludedQuestionIds.size > 0
            ? {
                notIn: Array.from(excludedQuestionIds),
              }
            : undefined,
        mediumId: scope.mediumId ?? undefined,
        subjectId: rule.subjectId ?? scope.subjectId ?? undefined,
        topicId:
          rule.topicIds.length > 0
            ? {
                in: rule.topicIds,
              }
            : undefined,
        difficulty: rule.difficulty ?? undefined,
        type: rule.type ?? undefined,
        subject: scope.examTrackId
          ? {
              examTrackId: scope.examTrackId,
            }
          : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
      },
    });

    return candidates;
  }

  private buildTestSlug(slug: string | undefined, title: string) {
    const normalizedSlug = normalizeOptionalText(slug);
    const source = typeof normalizedSlug === 'string' ? normalizedSlug : title;
    return slugifyTestValue(source).slice(0, 120);
  }

  private async syncTestQuestions(
    tx: Prisma.TransactionClient,
    siteId: string,
    testId: string,
    questions: NormalizedTestQuestionInput[],
  ) {
    await tx.testQuestion.deleteMany({
      where: {
        testId,
      },
    });

    if (questions.length === 0) {
      return;
    }

    await tx.testQuestion.createMany({
      data: questions.map((item) => ({
        siteId,
        testId,
        questionId: item.questionId,
        orderIndex: item.orderIndex,
        positiveMarks: item.positiveMarks,
        negativeMarks: item.negativeMarks,
      })),
    });
  }

  private async refreshTestMetrics(
    tx: Prisma.TransactionClient,
    testId: string,
    userId: string,
  ) {
    const [questionCount, marks] = await Promise.all([
      tx.testQuestion.count({
        where: {
          testId,
        },
      }),
      tx.testQuestion.aggregate({
        where: {
          testId,
        },
        _sum: {
          positiveMarks: true,
        },
      }),
    ]);

    await tx.test.update({
      where: {
        id: testId,
      },
      data: {
        questionCount,
        maxScore: marks._sum.positiveMarks ?? 0,
        updatedByUserId: userId,
      },
    });
  }

  private async assertPublishableTest(
    siteId: string,
    test: Prisma.TestGetPayload<{ select: typeof testDetailSelect }>,
  ) {
    if (test.questions.length === 0) {
      throw new BadRequestException({
        code: 'TEST_NOT_PUBLISHABLE',
        message: 'Tests require at least one question before publishing.',
      });
    }

    if (test.durationMinutes <= 0) {
      throw new BadRequestException({
        code: 'TEST_NOT_PUBLISHABLE',
        message: 'Tests require a positive duration before publishing.',
      });
    }

    this.validateAvailabilityWindow(
      test.availableFrom?.toISOString(),
      test.availableUntil?.toISOString(),
    );

    const sourceQuestions = await this.prisma.question.findMany({
      where: {
        id: {
          in: test.questions.map((item) => item.questionId),
        },
        siteId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (
      sourceQuestions.length !== test.questions.length ||
      sourceQuestions.some((item) => item.status !== QuestionStatus.PUBLISHED)
    ) {
      throw new BadRequestException({
        code: 'TEST_NOT_PUBLISHABLE',
        message:
          'All referenced questions must exist and be published before the test can be published.',
      });
    }
  }

  private assertStudentUser(user: AuthenticatedUser) {
    if (user.userType !== UserType.STUDENT) {
      throw new ForbiddenException({
        code: 'TEST_STUDENT_ACCESS_REQUIRED',
        message: 'Tests are available only for student users.',
      });
    }
  }

  private buildTestSnapshot(
    test: Prisma.TestGetPayload<{
      select: typeof testDetailSelect;
    }>,
  ) {
    return {
      id: test.id,
      code: test.code,
      slug: test.slug,
      title: test.title,
      shortDescription: test.shortDescription,
      family: test.family,
      durationMinutes: test.durationMinutes,
      questionCount: test.questionCount,
      maxScore: test.maxScore,
      examTrack: test.examTrack,
      medium: test.medium,
      subject: test.subject,
    };
  }

  private buildAttemptQuestionSnapshot(question: QuestionRecord) {
    const snapshot = mapStudentQuestionDetail(question);

    return JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
  }

  private toJson(value: Record<string, unknown> | Prisma.JsonObject) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private async finalizeExpiredAttempts(
    siteId: string,
    userId: string,
    testId?: string,
  ) {
    const expiredAttempts = await this.prisma.testAttempt.findMany({
      where: {
        siteId,
        userId,
        testId,
        status: TestAttemptStatus.ACTIVE,
        expiresAt: {
          lte: new Date(),
        },
      },
      select: {
        id: true,
      },
    });

    for (const attempt of expiredAttempts) {
      await this.finalizeAttempt(attempt.id, TestAttemptStatus.AUTO_SUBMITTED);
    }
  }

  private async getOwnedAttempt(attemptId: string, user: AuthenticatedUser) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: {
        id: attemptId,
        siteId: user.siteId,
        userId: user.userId,
      },
      select: testAttemptDetailSelect,
    });

    if (!attempt) {
      throw new NotFoundException({
        code: 'TEST_ATTEMPT_NOT_FOUND',
        message: 'Test attempt was not found.',
      });
    }

    return attempt;
  }

  private async getOwnedAttemptSummary(
    attemptId: string,
    user: AuthenticatedUser,
  ) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: {
        id: attemptId,
        siteId: user.siteId,
        userId: user.userId,
      },
      select: testAttemptSummarySelect,
    });

    if (!attempt) {
      throw new NotFoundException({
        code: 'TEST_ATTEMPT_NOT_FOUND',
        message: 'Test attempt was not found.',
      });
    }

    return attempt;
  }

  private async finalizeAttemptIfExpired(attempt: TestAttemptDetailRecord) {
    if (
      attempt.status === TestAttemptStatus.ACTIVE &&
      attempt.expiresAt <= new Date()
    ) {
      return this.finalizeAttempt(attempt.id, TestAttemptStatus.AUTO_SUBMITTED);
    }

    return attempt;
  }

  private normalizeAttemptAnswer(
    questionType: QuestionType,
    answerJson: Record<string, unknown>,
  ) {
    if (
      !answerJson ||
      typeof answerJson !== 'object' ||
      Array.isArray(answerJson)
    ) {
      throw new BadRequestException({
        code: 'TEST_ANSWER_INVALID',
        message: 'Answer payload must be an object.',
      });
    }

    if (questionType === QuestionType.TEXT_INPUT) {
      const text =
        typeof answerJson.text === 'string' ? answerJson.text.trim() : '';

      if (!text) {
        throw new BadRequestException({
          code: 'TEST_ANSWER_INVALID',
          message: 'Text-input answers require a non-empty text value.',
        });
      }

      return {
        text,
      };
    }

    const optionKeys = normalizeOptionKeys(
      Array.isArray(answerJson.optionKeys)
        ? answerJson.optionKeys.filter(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0,
          )
        : [],
    );

    if (optionKeys.length === 0) {
      throw new BadRequestException({
        code: 'TEST_ANSWER_INVALID',
        message: 'Choice questions require one or more option keys.',
      });
    }

    if (
      questionType === QuestionType.SINGLE_CHOICE &&
      optionKeys.length !== 1
    ) {
      throw new BadRequestException({
        code: 'TEST_ANSWER_INVALID',
        message: 'Single-choice questions require exactly one option key.',
      });
    }

    return {
      optionKeys,
    };
  }

  private evaluateAttemptAnswer(
    questionType: QuestionType,
    correctAnswerJson: Record<string, unknown>,
    answerJson: Record<string, unknown>,
  ) {
    if (questionType === QuestionType.TEXT_INPUT) {
      const acceptedAnswers = Array.isArray(correctAnswerJson.acceptedAnswers)
        ? correctAnswerJson.acceptedAnswers.filter(
            (item): item is string =>
              typeof item === 'string' && item.trim().length > 0,
          )
        : [];

      return acceptedAnswers
        .map((item) => normalizeAnswerText(item))
        .includes(
          normalizeAnswerText(
            typeof answerJson.text === 'string' ? answerJson.text : '',
          ),
        );
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

  private buildBreakdowns(scoredQuestions: AttemptQuestionScore[]) {
    const buildAccumulator = <T extends string>(
      getKey: (item: AttemptQuestionScore) => T | null,
      getLabel: (
        item: AttemptQuestionScore,
      ) => Record<string, unknown> | string | null,
    ) => {
      const values = new Map<
        string,
        {
          key: string;
          label: Record<string, unknown> | string | null;
          questionCount: number;
          answeredCount: number;
          correctCount: number;
          wrongCount: number;
          skippedCount: number;
          score: number;
          maxScore: number;
        }
      >();

      for (const item of scoredQuestions) {
        const key = getKey(item);
        const label = getLabel(item);

        if (!key || !label) {
          continue;
        }

        const current = values.get(key) ?? {
          key,
          label,
          questionCount: 0,
          answeredCount: 0,
          correctCount: 0,
          wrongCount: 0,
          skippedCount: 0,
          score: 0,
          maxScore: 0,
        };

        current.questionCount += 1;
        current.answeredCount += item.answered ? 1 : 0;
        current.correctCount += item.isCorrect ? 1 : 0;
        current.wrongCount += item.answered && item.isCorrect === false ? 1 : 0;
        current.skippedCount += item.answered ? 0 : 1;
        current.score += item.awardedMarks;
        current.maxScore += item.positiveMarks;
        values.set(key, current);
      }

      return Array.from(values.values()).map((value) => ({
        ...('string' === typeof value.label
          ? { label: value.label }
          : { item: value.label }),
        questionCount: value.questionCount,
        answeredCount: value.answeredCount,
        correctCount: value.correctCount,
        wrongCount: value.wrongCount,
        skippedCount: value.skippedCount,
        score: Number(value.score.toFixed(2)),
        maxScore: Number(value.maxScore.toFixed(2)),
        percentage: calculatePercentage(value.score, value.maxScore),
      }));
    };

    return {
      bySubject: buildAccumulator(
        (item) => item.subjectIdSnapshot,
        (item) =>
          (item.questionSnapshot.subject as
            | Record<string, unknown>
            | undefined) ?? null,
      ),
      byTopic: buildAccumulator(
        (item) => item.topicIdSnapshot,
        (item) =>
          (item.questionSnapshot.topic as
            | Record<string, unknown>
            | undefined) ?? null,
      ),
      byDifficulty: buildAccumulator(
        (item) => item.difficultySnapshot,
        (item) => item.difficultySnapshot,
      ),
      byQuestionType: buildAccumulator(
        (item) => item.questionTypeSnapshot,
        (item) => item.questionTypeSnapshot,
      ),
    };
  }

  private async finalizeAttempt(attemptId: string, status: TestAttemptStatus) {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: {
        id: attemptId,
      },
      select: testAttemptDetailSelect,
    });

    if (!attempt) {
      throw new NotFoundException({
        code: 'TEST_ATTEMPT_NOT_FOUND',
        message: 'Test attempt was not found.',
      });
    }

    if (attempt.status !== TestAttemptStatus.ACTIVE) {
      return attempt;
    }

    const submittedAt = new Date();
    const scoredQuestions: AttemptQuestionScore[] = attempt.questions.map(
      (item) => {
        const questionSnapshot =
          (item.questionSnapshotJson as Record<string, unknown>) ?? {};
        const finalAnswerJson =
          item.latestSavedAnswerJson &&
          typeof item.latestSavedAnswerJson === 'object'
            ? (item.latestSavedAnswerJson as Record<string, unknown>)
            : null;
        const correctAnswerJson = item.correctAnswerJson as Record<
          string,
          unknown
        >;
        const answered = Boolean(finalAnswerJson);
        const isCorrect = finalAnswerJson
          ? this.evaluateAttemptAnswer(
              item.questionTypeSnapshot,
              correctAnswerJson,
              finalAnswerJson,
            )
          : null;
        const awardedMarks = !finalAnswerJson
          ? 0
          : isCorrect
            ? item.positiveMarks
            : -item.negativeMarks;

        return {
          questionId: item.questionId,
          questionCodeSnapshot: item.questionCodeSnapshot,
          questionTypeSnapshot: item.questionTypeSnapshot,
          difficultySnapshot: item.difficultySnapshot,
          subjectIdSnapshot: item.subjectIdSnapshot,
          topicIdSnapshot: item.topicIdSnapshot,
          questionSnapshot,
          positiveMarks: item.positiveMarks,
          negativeMarks: item.negativeMarks,
          finalAnswerJson,
          awardedMarks,
          isCorrect,
          answered,
        };
      },
    );

    const answeredCount = scoredQuestions.filter(
      (item) => item.answered,
    ).length;
    const correctCount = scoredQuestions.filter(
      (item) => item.isCorrect,
    ).length;
    const wrongCount = scoredQuestions.filter(
      (item) => item.answered && item.isCorrect === false,
    ).length;
    const skippedCount = scoredQuestions.length - answeredCount;
    const score = Number(
      scoredQuestions
        .reduce((total, item) => total + item.awardedMarks, 0)
        .toFixed(2),
    );
    const maxScore = Number(
      scoredQuestions
        .reduce((total, item) => total + item.positiveMarks, 0)
        .toFixed(2),
    );
    const percentage = calculatePercentage(score, maxScore);
    const timeTakenSeconds = Math.max(
      0,
      Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
    );
    const breakdowns = this.buildBreakdowns(scoredQuestions);
    const summary = {
      submissionMode:
        status === TestAttemptStatus.AUTO_SUBMITTED ? 'auto' : 'manual',
      answeredCount,
      correctCount,
      wrongCount,
      skippedCount,
      score,
      maxScore,
      percentage,
      timeTakenSeconds,
    };

    await this.prisma.$transaction(async (tx) => {
      for (const item of scoredQuestions) {
        await tx.testAttemptQuestion.update({
          where: {
            id: attempt.questions.find(
              (question) => question.questionId === item.questionId,
            )?.id,
          },
          data: {
            finalAnswerJson: item.finalAnswerJson
              ? this.toJson(item.finalAnswerJson)
              : Prisma.DbNull,
            answeredAt: item.answered ? submittedAt : null,
            isCorrect: item.isCorrect,
            awardedMarks: item.awardedMarks,
          },
        });
      }

      await tx.testAttempt.update({
        where: {
          id: attempt.id,
        },
        data: {
          status,
          answeredCount,
          correctCount,
          wrongCount,
          skippedCount,
          score,
          maxScore,
          percentage,
          timeTakenSeconds,
          resultSummaryJson: this.toJson(summary),
          resultBreakdownJson: this.toJson(
            breakdowns as unknown as Prisma.JsonObject,
          ),
          submittedAt,
        },
      });
    });

    const latest = await this.prisma.testAttempt.findUnique({
      where: {
        id: attemptId,
      },
      select: testAttemptDetailSelect,
    });

    if (!latest) {
      throw new NotFoundException({
        code: 'TEST_ATTEMPT_NOT_FOUND',
        message: 'Test attempt was not found.',
      });
    }

    return latest;
  }
}
