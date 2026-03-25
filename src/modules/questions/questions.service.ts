import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  Prisma,
  QuestionMediaUsage,
  QuestionStatus,
  QuestionType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import type {
  CreateQuestionDto,
  ListAdminQuestionsQueryDto,
  ListQuestionsQueryDto,
  QuestionMediaReferenceInputDto,
  QuestionOptionInputDto,
  UpdateQuestionDto,
} from './dto/manage-questions.dto';
import {
  mapAdminQuestionDetail,
  mapQuestionSummary,
  mapStudentQuestionDetail,
  questionSelect,
  type QuestionRecord,
} from './questions.types';
import { buildQuestionSearchText, normalizeOptionKey } from './questions.utils';

type NormalizedOptionInput = {
  optionKey: string;
  orderIndex: number;
  contentJson: Record<string, unknown>;
  metaJson: Record<string, unknown> | null;
};

type NormalizedMediaReferenceInput = {
  fileAssetId: string;
  usage: QuestionMediaUsage;
  optionKey: string | null;
  localeCode: string | null;
  orderIndex: number;
};

type QuestionMediaAssetRecord = {
  id: string;
  purpose: FileAssetPurpose;
  accessLevel: FileAssetAccess;
  status: FileAssetStatus;
  contentType: string;
};

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdminQuestions(siteId: string, query: ListAdminQuestionsQueryDto) {
    const where = this.buildAdminQuestionsWhere(siteId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: questionSelect,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: items.map((item) => mapQuestionSummary(item)),
      total,
    };
  }

  async getAdminQuestion(siteId: string, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        siteId,
      },
      select: questionSelect,
    });

    if (!question) {
      throw new NotFoundException({
        code: 'QUESTION_NOT_FOUND',
        message: 'Question was not found.',
      });
    }

    return mapAdminQuestionDetail(question);
  }

  async createQuestion(user: AuthenticatedUser, input: CreateQuestionDto) {
    await this.validateSubjectContext(
      user.siteId,
      input.subjectId,
      input.topicId,
    );
    if (input.mediumId) {
      await this.ensureMedium(user.siteId, input.mediumId);
    }

    const options = this.normalizeAndValidateOptions(
      input.type,
      input.options ?? [],
    );
    const mediaReferences = this.normalizeMediaReferences(
      input.mediaReferences ?? [],
      options,
    );
    const mediaAssets = await this.validateMediaAssets(
      user.siteId,
      mediaReferences,
    );
    this.validateCorrectAnswer(input.type, input.correctAnswerJson, options);

    const questionId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          siteId: user.siteId,
          code: input.code ?? null,
          mediumId: input.mediumId ?? null,
          subjectId: input.subjectId,
          topicId: input.topicId ?? null,
          type: input.type,
          difficulty: input.difficulty,
          statementJson: input.statementJson as Prisma.InputJsonValue,
          explanationJson:
            input.explanationJson === undefined
              ? Prisma.DbNull
              : (input.explanationJson as Prisma.InputJsonValue),
          metadataJson:
            input.metadataJson === undefined
              ? Prisma.DbNull
              : (input.metadataJson as Prisma.InputJsonValue),
          correctAnswerJson: input.correctAnswerJson as Prisma.InputJsonValue,
          searchText: buildQuestionSearchText(
            input.code,
            input.statementJson,
            input.explanationJson,
            options.map((option) => option.contentJson),
          ),
          hasMedia: mediaReferences.length > 0,
          createdByUserId: user.userId,
          updatedByUserId: user.userId,
        },
        select: {
          id: true,
          siteId: true,
        },
      });

      await this.syncQuestionOptions(tx, created.id, options);
      await this.syncQuestionMediaReferences(tx, created.id, mediaReferences);
      await this.syncQuestionFileAssetReferences(tx, {
        siteId: created.siteId,
        questionId: created.id,
        mediaReferences,
      });

      return created.id;
    });

    return this.getAdminQuestion(user.siteId, questionId);
  }

  async updateQuestion(
    user: AuthenticatedUser,
    questionId: string,
    input: UpdateQuestionDto,
  ) {
    const existing = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        siteId: user.siteId,
      },
      select: questionSelect,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'QUESTION_NOT_FOUND',
        message: 'Question was not found.',
      });
    }

    const nextType = input.type ?? existing.type;
    const nextSubjectId = input.subjectId ?? existing.subjectId;
    const nextTopicId =
      input.topicId === undefined ? existing.topicId : (input.topicId ?? null);
    const nextMediumId =
      input.mediumId === undefined
        ? existing.mediumId
        : (input.mediumId ?? null);
    const nextOptions =
      input.options === undefined
        ? existing.options.map((option) => ({
            optionKey: option.optionKey,
            orderIndex: option.orderIndex,
            contentJson: option.contentJson as Record<string, unknown>,
            metaJson:
              option.metaJson && typeof option.metaJson === 'object'
                ? (option.metaJson as Record<string, unknown>)
                : null,
          }))
        : this.normalizeAndValidateOptions(nextType, input.options);
    const nextMediaReferences =
      input.mediaReferences === undefined
        ? existing.mediaReferences.map((reference) => ({
            fileAssetId: reference.fileAssetId,
            usage: reference.usage,
            optionKey: reference.optionKey,
            localeCode: reference.localeCode,
            orderIndex: reference.orderIndex,
          }))
        : this.normalizeMediaReferences(input.mediaReferences, nextOptions);

    await this.validateSubjectContext(user.siteId, nextSubjectId, nextTopicId);
    if (nextMediumId) {
      await this.ensureMedium(user.siteId, nextMediumId);
    }

    await this.validateMediaAssets(user.siteId, nextMediaReferences);
    this.validateCorrectAnswer(
      nextType,
      input.correctAnswerJson ??
        (existing.correctAnswerJson as Record<string, unknown>),
      nextOptions,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.question.update({
        where: { id: questionId },
        data: {
          code: input.code === undefined ? undefined : (input.code ?? null),
          mediumId: input.mediumId === undefined ? undefined : nextMediumId,
          subjectId: nextSubjectId,
          topicId: input.topicId === undefined ? undefined : nextTopicId,
          type: nextType,
          difficulty: input.difficulty,
          statementJson:
            input.statementJson === undefined
              ? undefined
              : (input.statementJson as Prisma.InputJsonValue),
          explanationJson:
            input.explanationJson === undefined
              ? undefined
              : input.explanationJson === null
                ? Prisma.DbNull
                : (input.explanationJson as Prisma.InputJsonValue),
          metadataJson:
            input.metadataJson === undefined
              ? undefined
              : input.metadataJson === null
                ? Prisma.DbNull
                : (input.metadataJson as Prisma.InputJsonValue),
          correctAnswerJson:
            input.correctAnswerJson === undefined
              ? undefined
              : (input.correctAnswerJson as Prisma.InputJsonValue),
          searchText: buildQuestionSearchText(
            input.code ?? existing.code,
            input.statementJson ?? existing.statementJson,
            input.explanationJson ?? existing.explanationJson,
            nextOptions.map((option) => option.contentJson),
          ),
          hasMedia: nextMediaReferences.length > 0,
          updatedByUserId: user.userId,
        },
      });

      await this.syncQuestionOptions(tx, questionId, nextOptions);
      await this.syncQuestionMediaReferences(
        tx,
        questionId,
        nextMediaReferences,
      );
      await this.syncQuestionFileAssetReferences(tx, {
        siteId: user.siteId,
        questionId,
        mediaReferences: nextMediaReferences,
      });
    });

    return this.getAdminQuestion(user.siteId, questionId);
  }

  async publishQuestion(user: AuthenticatedUser, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        siteId: user.siteId,
      },
      select: questionSelect,
    });

    if (!question) {
      throw new NotFoundException({
        code: 'QUESTION_NOT_FOUND',
        message: 'Question was not found.',
      });
    }

    this.assertPublishableQuestion(question);

    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        status: QuestionStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminQuestion(user.siteId, questionId);
  }

  async unpublishQuestion(user: AuthenticatedUser, questionId: string) {
    const existing = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        siteId: user.siteId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'QUESTION_NOT_FOUND',
        message: 'Question was not found.',
      });
    }

    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        status: QuestionStatus.DRAFT,
        publishedAt: null,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminQuestion(user.siteId, questionId);
  }

  async listPublishedQuestions(
    user: AuthenticatedUser,
    query: ListQuestionsQueryDto,
  ) {
    const where = this.buildPublishedQuestionsWhere(user.siteId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: questionSelect,
      }),
      this.prisma.question.count({ where }),
    ]);

    return {
      items: items.map((item) => mapQuestionSummary(item)),
      total,
    };
  }

  async getPublishedQuestion(user: AuthenticatedUser, questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: {
        id: questionId,
        siteId: user.siteId,
        status: QuestionStatus.PUBLISHED,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
      select: questionSelect,
    });

    if (!question) {
      throw new NotFoundException({
        code: 'QUESTION_NOT_FOUND',
        message: 'Published question was not found.',
      });
    }

    return mapStudentQuestionDetail(question);
  }

  private buildAdminQuestionsWhere(
    siteId: string,
    query: ListAdminQuestionsQueryDto,
  ): Prisma.QuestionWhereInput {
    const and: Prisma.QuestionWhereInput[] = [];
    if (query.search) {
      and.push({
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { searchText: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      siteId,
      subjectId: query.subjectId,
      topicId: query.topicId,
      mediumId: query.mediumId,
      type: query.type,
      difficulty: query.difficulty,
      status: query.status,
      hasMedia: query.hasMedia,
      subject: query.examTrackId
        ? {
            examTrackId: query.examTrackId,
          }
        : undefined,
      AND: and.length > 0 ? and : undefined,
    };
  }

  private buildPublishedQuestionsWhere(
    siteId: string,
    query: ListQuestionsQueryDto,
  ): Prisma.QuestionWhereInput {
    const and: Prisma.QuestionWhereInput[] = [
      {
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
    ];
    if (query.search) {
      and.push({
        OR: [
          { code: { contains: query.search, mode: 'insensitive' } },
          { searchText: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      siteId,
      subjectId: query.subjectId,
      topicId: query.topicId,
      mediumId: query.mediumId,
      type: query.type,
      difficulty: query.difficulty,
      hasMedia: query.hasMedia,
      status: QuestionStatus.PUBLISHED,
      subject: query.examTrackId
        ? {
            examTrackId: query.examTrackId,
          }
        : undefined,
      AND: and,
    };
  }

  private async validateSubjectContext(
    siteId: string,
    subjectId: string,
    topicId?: string | null,
  ) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new BadRequestException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'Subject was not found for this site.',
      });
    }

    if (!topicId) {
      return;
    }

    const topic = await this.prisma.topic.findFirst({
      where: {
        id: topicId,
        siteId,
        subjectId,
      },
      select: {
        id: true,
      },
    });

    if (!topic) {
      throw new BadRequestException({
        code: 'TOPIC_NOT_FOUND',
        message: 'Topic was not found for the selected subject.',
      });
    }
  }

  private async ensureMedium(siteId: string, mediumId: string) {
    const medium = await this.prisma.medium.findFirst({
      where: {
        id: mediumId,
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (!medium) {
      throw new BadRequestException({
        code: 'MEDIUM_NOT_FOUND',
        message: 'Medium was not found for this site.',
      });
    }
  }

  private normalizeAndValidateOptions(
    questionType: QuestionType,
    options: QuestionOptionInputDto[],
  ) {
    const normalizedOptions: NormalizedOptionInput[] = options.map(
      (option, index) => ({
        optionKey: option.optionKey,
        orderIndex: option.orderIndex ?? (index + 1) * 10,
        contentJson: option.contentJson,
        metaJson: option.metaJson ?? null,
      }),
    );

    if (questionType === QuestionType.TEXT_INPUT) {
      if (normalizedOptions.length > 0) {
        throw new BadRequestException({
          code: 'QUESTION_OPTIONS_NOT_ALLOWED',
          message: 'TEXT_INPUT questions cannot include options.',
        });
      }

      return normalizedOptions;
    }

    if (normalizedOptions.length < 2) {
      throw new BadRequestException({
        code: 'QUESTION_OPTIONS_REQUIRED',
        message: 'Choice questions require at least two options.',
      });
    }

    const optionKeys = new Set<string>();
    for (const option of normalizedOptions) {
      const normalizedKey = normalizeOptionKey(option.optionKey);
      if (typeof normalizedKey !== 'string') {
        throw new BadRequestException({
          code: 'QUESTION_OPTION_KEY_INVALID',
          message: 'Question option keys must be valid strings.',
        });
      }

      if (optionKeys.has(normalizedKey)) {
        throw new BadRequestException({
          code: 'QUESTION_OPTION_KEY_DUPLICATE',
          message: 'Question option keys must be unique.',
        });
      }

      optionKeys.add(normalizedKey);
    }

    return normalizedOptions;
  }

  private normalizeMediaReferences(
    mediaReferences: QuestionMediaReferenceInputDto[],
    options: NormalizedOptionInput[],
  ) {
    const optionKeys = new Set(options.map((option) => option.optionKey));
    const normalizedMediaReferences: NormalizedMediaReferenceInput[] =
      mediaReferences.map((reference, index) => ({
        fileAssetId: reference.fileAssetId,
        usage: reference.usage,
        optionKey: reference.optionKey ?? null,
        localeCode: reference.localeCode ?? null,
        orderIndex: reference.orderIndex ?? (index + 1) * 10,
      }));

    const uniqueKeys = new Set<string>();
    for (const reference of normalizedMediaReferences) {
      if (reference.usage === QuestionMediaUsage.OPTION) {
        if (!reference.optionKey || !optionKeys.has(reference.optionKey)) {
          throw new BadRequestException({
            code: 'QUESTION_MEDIA_OPTION_KEY_INVALID',
            message:
              'OPTION media references must target an existing option key.',
          });
        }
      } else if (reference.optionKey) {
        throw new BadRequestException({
          code: 'QUESTION_MEDIA_OPTION_KEY_UNEXPECTED',
          message: 'Only OPTION media references can include an option key.',
        });
      }

      const uniqueKey = [
        reference.fileAssetId,
        reference.usage,
        reference.optionKey ?? '',
        reference.localeCode ?? '',
      ].join(':');

      if (uniqueKeys.has(uniqueKey)) {
        throw new BadRequestException({
          code: 'QUESTION_MEDIA_REFERENCE_DUPLICATE',
          message: 'Question media references must be unique.',
        });
      }

      uniqueKeys.add(uniqueKey);
    }

    return normalizedMediaReferences;
  }

  private async validateMediaAssets(
    siteId: string,
    mediaReferences: NormalizedMediaReferenceInput[],
  ) {
    const allowedPurposes: FileAssetPurpose[] = [
      FileAssetPurpose.QUESTION_IMAGE,
      FileAssetPurpose.GENERIC_IMAGE,
    ];

    const assetIds = Array.from(
      new Set(mediaReferences.map((reference) => reference.fileAssetId)),
    );
    if (assetIds.length === 0) {
      return [] as QuestionMediaAssetRecord[];
    }

    const assets = await this.prisma.fileAsset.findMany({
      where: {
        id: {
          in: assetIds,
        },
        siteId,
      },
      select: {
        id: true,
        purpose: true,
        accessLevel: true,
        status: true,
        contentType: true,
      },
    });

    if (assets.length !== assetIds.length) {
      throw new BadRequestException({
        code: 'QUESTION_MEDIA_ASSET_NOT_FOUND',
        message: 'One or more media assets were not found for this site.',
      });
    }

    for (const asset of assets) {
      if (
        asset.status !== FileAssetStatus.READY ||
        !allowedPurposes.includes(asset.purpose) ||
        !asset.contentType.startsWith('image/')
      ) {
        throw new BadRequestException({
          code: 'QUESTION_MEDIA_ASSET_INVALID',
          message:
            'Question media references require ready image assets uploaded for question or generic image usage.',
        });
      }

      if (
        asset.accessLevel !== FileAssetAccess.AUTHENTICATED &&
        asset.accessLevel !== FileAssetAccess.PUBLIC
      ) {
        throw new BadRequestException({
          code: 'QUESTION_MEDIA_ASSET_ACCESS_INVALID',
          message:
            'Question media assets must use PUBLIC or AUTHENTICATED access.',
        });
      }
    }

    return assets;
  }

  private validateCorrectAnswer(
    questionType: QuestionType,
    correctAnswerJson: Record<string, unknown>,
    options: NormalizedOptionInput[],
  ) {
    const optionKeys = new Set(options.map((option) => option.optionKey));

    if (questionType === QuestionType.TEXT_INPUT) {
      const acceptedAnswers = correctAnswerJson.acceptedAnswers;
      if (
        !Array.isArray(acceptedAnswers) ||
        acceptedAnswers.length === 0 ||
        acceptedAnswers.some(
          (answer) => typeof answer !== 'string' || answer.trim().length === 0,
        )
      ) {
        throw new BadRequestException({
          code: 'QUESTION_CORRECT_ANSWER_INVALID',
          message:
            'TEXT_INPUT questions require correctAnswerJson.acceptedAnswers as a non-empty string array.',
        });
      }

      return;
    }

    const selectedOptionKeys = correctAnswerJson.optionKeys;
    if (
      !Array.isArray(selectedOptionKeys) ||
      selectedOptionKeys.length === 0 ||
      selectedOptionKeys.some(
        (optionKey) =>
          typeof optionKey !== 'string' || !optionKeys.has(optionKey),
      )
    ) {
      throw new BadRequestException({
        code: 'QUESTION_CORRECT_ANSWER_INVALID',
        message:
          'Choice questions require correctAnswerJson.optionKeys that match existing option keys.',
      });
    }

    if (
      questionType === QuestionType.SINGLE_CHOICE &&
      selectedOptionKeys.length !== 1
    ) {
      throw new BadRequestException({
        code: 'QUESTION_CORRECT_ANSWER_INVALID',
        message:
          'SINGLE_CHOICE questions require exactly one correct option key.',
      });
    }
  }

  private assertPublishableQuestion(question: QuestionRecord) {
    if (
      question.type !== QuestionType.TEXT_INPUT &&
      question.options.length < 2
    ) {
      throw new BadRequestException({
        code: 'QUESTION_OPTIONS_REQUIRED',
        message:
          'Choice questions require at least two options before publishing.',
      });
    }

    for (const reference of question.mediaReferences) {
      if (
        reference.fileAsset.accessLevel !== FileAssetAccess.AUTHENTICATED &&
        reference.fileAsset.accessLevel !== FileAssetAccess.PUBLIC
      ) {
        throw new BadRequestException({
          code: 'QUESTION_MEDIA_ASSET_ACCESS_INVALID',
          message:
            'Published questions require media assets to use PUBLIC or AUTHENTICATED access.',
        });
      }
    }

    this.validateCorrectAnswer(
      question.type,
      question.correctAnswerJson as Record<string, unknown>,
      question.options.map((option) => ({
        optionKey: option.optionKey,
        orderIndex: option.orderIndex,
        contentJson: option.contentJson as Record<string, unknown>,
        metaJson:
          option.metaJson && typeof option.metaJson === 'object'
            ? (option.metaJson as Record<string, unknown>)
            : null,
      })),
    );
  }

  private async syncQuestionOptions(
    tx: Prisma.TransactionClient,
    questionId: string,
    options: NormalizedOptionInput[],
  ) {
    await tx.questionOption.deleteMany({
      where: {
        questionId,
      },
    });

    if (options.length === 0) {
      return;
    }

    await tx.questionOption.createMany({
      data: options.map((option) => ({
        questionId,
        optionKey: option.optionKey,
        orderIndex: option.orderIndex,
        contentJson: option.contentJson as Prisma.InputJsonValue,
        metaJson:
          option.metaJson === null
            ? Prisma.DbNull
            : (option.metaJson as Prisma.InputJsonValue),
      })),
      skipDuplicates: true,
    });
  }

  private async syncQuestionMediaReferences(
    tx: Prisma.TransactionClient,
    questionId: string,
    mediaReferences: NormalizedMediaReferenceInput[],
  ) {
    await tx.questionMediaReference.deleteMany({
      where: {
        questionId,
      },
    });

    if (mediaReferences.length === 0) {
      return;
    }

    await tx.questionMediaReference.createMany({
      data: mediaReferences.map((reference) => ({
        questionId,
        fileAssetId: reference.fileAssetId,
        usage: reference.usage,
        optionKey: reference.optionKey,
        localeCode: reference.localeCode,
        orderIndex: reference.orderIndex,
      })),
      skipDuplicates: true,
    });
  }

  private async syncQuestionFileAssetReferences(
    tx: Prisma.TransactionClient,
    input: {
      siteId: string;
      questionId: string;
      mediaReferences: NormalizedMediaReferenceInput[];
    },
  ) {
    await tx.fileAssetReference.deleteMany({
      where: {
        siteId: input.siteId,
        resourceType: 'question',
        resourceId: input.questionId,
      },
    });

    if (input.mediaReferences.length === 0) {
      return;
    }

    await tx.fileAssetReference.createMany({
      data: input.mediaReferences.map((reference, index) => ({
        siteId: input.siteId,
        fileAssetId: reference.fileAssetId,
        resourceType: 'question',
        resourceId: input.questionId,
        slot: [
          reference.usage.toLowerCase(),
          reference.optionKey ?? 'global',
          reference.localeCode ?? 'default',
          index,
        ].join(':'),
        accessLevel: FileAssetAccess.AUTHENTICATED,
      })),
      skipDuplicates: true,
    });
  }
}
