import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentStatus,
  EnglishSpeakingAudioStatus,
  EnglishSpeakingLanguage,
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ObjectStorageService } from '../../infra/storage/object-storage.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { slugifyContentValue } from '../content/content.utils';
import { StudentEnglishSpeakingTopicAccessMode } from './dto/english-speaking-response.dto';
import type {
  CreateEnglishSpeakingTopicDto,
  FinalizeEnglishSpeakingAudioDto,
  GenerateEnglishSpeakingAudioDto,
  ListAdminEnglishSpeakingQueryDto,
  PublishEnglishSpeakingTopicDto,
  UpdateEnglishSpeakingTopicDto,
  UpsertEnglishSpeakingSentenceDto,
} from './dto/manage-english-speaking.dto';
import {
  ENGLISH_SPEAKING_AUDIO_CONTENT_TYPE,
  ENGLISH_SPEAKING_AUDIO_EXTENSION,
  ENGLISH_SPEAKING_AUDIO_LANGUAGES,
  ENGLISH_SPEAKING_LANGUAGE_CONFIG,
} from './english-speaking.constants';
import { EnglishSpeakingEntitlementService } from './english-speaking.entitlement.service';
import { EnglishSpeakingSettingsService } from './english-speaking.settings.service';
import { ElevenLabsTtsService } from './elevenlabs-tts.service';
import {
  countReadyEnglishSpeakingSentences,
  englishSpeakingSentenceAudioSelect,
  englishSpeakingTopicSelect,
  findSentenceAudioRecord,
  getSentenceText,
  hashEnglishSpeakingText,
  isCurrentSentenceAudio,
  type EnglishSpeakingSentenceRecord,
  type EnglishSpeakingTopicRecord,
} from './english-speaking.types';

type AudioVariant = 'finalized' | 'preview';

type NormalizedSentenceInput = {
  englishText: string;
  hindiText: string;
  id?: string;
  marathiText: string;
  orderIndex: number;
};

const adminSentenceContextSelect =
  Prisma.validator<Prisma.EnglishSpeakingSentenceSelect>()({
    id: true,
    orderIndex: true,
    hindiText: true,
    marathiText: true,
    englishText: true,
    audioRecords: {
      select: englishSpeakingSentenceAudioSelect,
    },
    topic: {
      select: {
        id: true,
        siteId: true,
        slug: true,
        title: true,
        visibility: true,
        accessType: true,
        status: true,
        publishedAt: true,
        site: {
          select: {
            code: true,
          },
        },
      },
    },
  });

type AdminSentenceContextRecord = Prisma.EnglishSpeakingSentenceGetPayload<{
  select: typeof adminSentenceContextSelect;
}>;

@Injectable()
export class EnglishSpeakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly englishSpeakingSettingsService: EnglishSpeakingSettingsService,
    private readonly englishSpeakingEntitlementService: EnglishSpeakingEntitlementService,
    private readonly elevenLabsTtsService: ElevenLabsTtsService,
  ) {}

  async listAdminTopics(
    siteId: string,
    query: ListAdminEnglishSpeakingQueryDto,
  ) {
    const where = this.buildAdminTopicWhere(siteId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.englishSpeakingTopic.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        select: englishSpeakingTopicSelect,
      }),
      this.prisma.englishSpeakingTopic.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapAdminTopicSummary(item)),
      total,
    };
  }

  async getAdminTopic(siteId: string, topicId: string) {
    const topic = await this.getAdminTopicRecord(siteId, topicId);
    return this.mapAdminTopicDetail(topic);
  }

  async createTopic(
    user: AuthenticatedUser,
    input: CreateEnglishSpeakingTopicDto,
  ) {
    const slug = this.resolveSlug(input.slug, input.title);
    const orderIndex =
      input.orderIndex ?? (await this.getNextTopicOrderIndex(user.siteId));
    const sentences = this.normalizeSentenceInputs(input.sentences ?? []);

    const created = await this.prisma.$transaction(async (tx) => {
      const topic = await tx.englishSpeakingTopic.create({
        data: {
          accessType: input.accessType ?? ContentAccessType.FREE,
          createdByUserId: user.userId,
          description: this.normalizeOptionalText(input.description),
          orderIndex,
          siteId: user.siteId,
          slug,
          title: input.title.trim(),
          updatedByUserId: user.userId,
          visibility: input.visibility ?? CatalogVisibility.AUTHENTICATED,
        },
        select: {
          id: true,
        },
      });

      if (sentences.length > 0) {
        await tx.englishSpeakingSentence.createMany({
          data: sentences.map((sentence) => ({
            englishText: sentence.englishText,
            hindiText: sentence.hindiText,
            marathiText: sentence.marathiText,
            orderIndex: sentence.orderIndex,
            topicId: topic.id,
          })),
        });
      }

      return topic;
    });

    return this.getAdminTopic(user.siteId, created.id);
  }

  async updateTopic(
    user: AuthenticatedUser,
    topicId: string,
    input: UpdateEnglishSpeakingTopicDto,
  ) {
    const existing = await this.getAdminTopicRecord(user.siteId, topicId);
    const normalizedSentences =
      input.sentences === undefined
        ? null
        : this.normalizeSentenceInputs(input.sentences);
    const hasSentenceMutation =
      normalizedSentences === null
        ? false
        : this.hasSentenceMutation(existing.sentences, normalizedSentences);
    const deletedAssetIds =
      normalizedSentences === null
        ? []
        : this.collectDeletedAssetIds(existing.sentences, normalizedSentences);

    const nextSlug =
      input.slug === undefined && input.title === undefined
        ? undefined
        : this.resolveSlug(
            input.slug ?? existing.slug,
            input.title ?? existing.title,
          );

    await this.prisma.$transaction(async (tx) => {
      await tx.englishSpeakingTopic.update({
        where: {
          id: existing.id,
        },
        data: {
          accessType: input.accessType,
          description:
            input.description === undefined
              ? undefined
              : this.normalizeOptionalText(input.description),
          orderIndex: input.orderIndex,
          publishedAt:
            hasSentenceMutation && existing.status === ContentStatus.PUBLISHED
              ? null
              : undefined,
          publishedByUserId:
            hasSentenceMutation && existing.status === ContentStatus.PUBLISHED
              ? null
              : undefined,
          slug: nextSlug,
          status:
            hasSentenceMutation && existing.status === ContentStatus.PUBLISHED
              ? ContentStatus.DRAFT
              : undefined,
          title: input.title?.trim(),
          updatedByUserId: user.userId,
          visibility: input.visibility,
        },
      });

      if (normalizedSentences !== null) {
        await this.syncSentences(
          tx,
          existing.sentences,
          existing.id,
          normalizedSentences,
        );
      }
    });

    if (deletedAssetIds.length > 0) {
      await this.revokeAudioAssets(user.siteId, deletedAssetIds);
    }

    return this.getAdminTopic(user.siteId, topicId);
  }

  async publishTopic(
    user: AuthenticatedUser,
    topicId: string,
    input: PublishEnglishSpeakingTopicDto,
  ) {
    const topic = await this.getAdminTopicRecord(user.siteId, topicId);
    this.assertTopicReadyForPublish(topic);

    await this.prisma.englishSpeakingTopic.update({
      where: {
        id: topic.id,
      },
      data: {
        publishedAt: input.publishAt ? new Date(input.publishAt) : new Date(),
        publishedByUserId: user.userId,
        status: ContentStatus.PUBLISHED,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminTopic(user.siteId, topic.id);
  }

  async unpublishTopic(user: AuthenticatedUser, topicId: string) {
    await this.ensureAdminTopicExists(user.siteId, topicId);

    await this.prisma.englishSpeakingTopic.update({
      where: {
        id: topicId,
      },
      data: {
        publishedAt: null,
        publishedByUserId: null,
        status: ContentStatus.DRAFT,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminTopic(user.siteId, topicId);
  }

  async deleteTopic(user: AuthenticatedUser, topicId: string) {
    const topic = await this.getAdminTopicRecord(user.siteId, topicId);
    const assetIds = this.collectTopicAssetIds(topic);

    await this.prisma.englishSpeakingTopic.delete({
      where: {
        id: topic.id,
      },
    });

    if (assetIds.length > 0) {
      await this.revokeAudioAssets(user.siteId, assetIds);
    }

    return {
      message: 'English speaking topic deleted.',
    };
  }

  async generateSentenceAudio(
    user: AuthenticatedUser,
    sentenceId: string,
    input: GenerateEnglishSpeakingAudioDto,
  ) {
    const sentence = await this.getAdminSentenceContext(
      user.siteId,
      sentenceId,
    );
    const languages = this.normalizeLanguages(input.languages);

    await this.generateAudioPreviewsForSentence(user, sentence, languages);

    return this.getAdminTopic(user.siteId, sentence.topic.id);
  }

  async generateTopicAudio(
    user: AuthenticatedUser,
    topicId: string,
    input: GenerateEnglishSpeakingAudioDto,
  ) {
    const topic = await this.getAdminTopicRecord(user.siteId, topicId);
    this.assertTopicHasSentences(topic);
    const languages = this.normalizeLanguages(input.languages);

    for (const sentenceSummary of this.sortSentences(topic.sentences)) {
      const sentence = await this.getAdminSentenceContext(
        user.siteId,
        sentenceSummary.id,
      );
      await this.generateAudioPreviewsForSentence(user, sentence, languages);
    }

    return this.getAdminTopic(user.siteId, topic.id);
  }

  async finalizeSentenceAudio(
    user: AuthenticatedUser,
    sentenceId: string,
    input: FinalizeEnglishSpeakingAudioDto,
  ) {
    const sentence = await this.getAdminSentenceContext(
      user.siteId,
      sentenceId,
    );
    const languages = this.normalizeLanguages(input.languages);

    await this.finalizeAudioForSentence(user, sentence, languages);

    return this.getAdminTopic(user.siteId, sentence.topic.id);
  }

  async finalizeTopicAudio(
    user: AuthenticatedUser,
    topicId: string,
    input: FinalizeEnglishSpeakingAudioDto,
  ) {
    const topic = await this.getAdminTopicRecord(user.siteId, topicId);
    this.assertTopicHasSentences(topic);
    const languages = this.normalizeLanguages(input.languages);
    const sentenceContexts: AdminSentenceContextRecord[] = [];

    for (const sentenceSummary of this.sortSentences(topic.sentences)) {
      const sentence = await this.getAdminSentenceContext(
        user.siteId,
        sentenceSummary.id,
      );

      for (const language of languages) {
        this.assertPreviewReadyForFinalize(sentence, language);
      }

      sentenceContexts.push(sentence);
    }

    for (const sentence of sentenceContexts) {
      await this.finalizeAudioForSentence(user, sentence, languages);
    }

    return this.getAdminTopic(user.siteId, topic.id);
  }

  async streamAdminAudio(
    siteId: string,
    sentenceId: string,
    language: EnglishSpeakingLanguage,
    variant: AudioVariant,
    response: Response,
  ): Promise<StreamableFile> {
    const sentence = await this.getAdminSentenceContext(siteId, sentenceId);
    const record = findSentenceAudioRecord(sentence, language);
    const assetId =
      variant === 'preview'
        ? record?.previewFileAssetId
        : record?.finalizedFileAssetId;

    if (!assetId) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_AUDIO_NOT_FOUND',
        message: 'The requested English speaking audio was not found.',
      });
    }

    const asset = await this.getAudioAsset(siteId, assetId);
    return this.streamAudioAsset(asset, response, 'private, no-store');
  }

  async listStudentTopics(user: AuthenticatedUser) {
    const premiumAccess =
      await this.englishSpeakingEntitlementService.canAccessPremiumTopics(
        user.siteId,
        user.userId,
      );
    const items = await this.prisma.englishSpeakingTopic.findMany({
      where: this.buildStudentTopicWhere(user.siteId),
      orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
      select: englishSpeakingTopicSelect,
    });

    return {
      items: items.map((item) =>
        this.mapStudentTopicSummary(item, premiumAccess),
      ),
      total: items.length,
    };
  }

  async getStudentTopic(user: AuthenticatedUser, slug: string) {
    const topic = await this.prisma.englishSpeakingTopic.findFirst({
      where: {
        ...this.buildStudentTopicWhere(user.siteId),
        slug,
      },
      select: englishSpeakingTopicSelect,
    });

    if (!topic) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_TOPIC_NOT_FOUND',
        message: 'English speaking topic was not found.',
      });
    }

    const premiumAccess =
      await this.englishSpeakingEntitlementService.canAccessPremiumTopics(
        user.siteId,
        user.userId,
      );

    return this.mapStudentTopicDetail(topic, premiumAccess);
  }

  async streamStudentAudio(
    user: AuthenticatedUser,
    sentenceId: string,
    language: EnglishSpeakingLanguage,
    response: Response,
  ): Promise<StreamableFile> {
    const sentence = await this.prisma.englishSpeakingSentence.findFirst({
      where: {
        id: sentenceId,
        topic: this.buildStudentTopicWhere(user.siteId),
      },
      select: adminSentenceContextSelect,
    });

    if (!sentence) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_SENTENCE_NOT_FOUND',
        message: 'The requested English speaking sentence was not found.',
      });
    }

    if (sentence.topic.accessType === ContentAccessType.PREMIUM) {
      const hasPremiumAccess =
        await this.englishSpeakingEntitlementService.canAccessPremiumTopics(
          user.siteId,
          user.userId,
        );

      if (!hasPremiumAccess) {
        throw new ForbiddenException({
          code: 'ENGLISH_SPEAKING_PREMIUM_REQUIRED',
          message:
            'Active premium access is required to listen to this English speaking topic.',
        });
      }
    }

    const record = findSentenceAudioRecord(sentence, language);

    if (
      !record?.finalizedFileAssetId ||
      !record.textHash ||
      !isCurrentSentenceAudio(sentence, record)
    ) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_AUDIO_NOT_FOUND',
        message: 'A finalized audio track is not available for this sentence.',
      });
    }

    const asset = await this.getAudioAsset(
      user.siteId,
      record.finalizedFileAssetId,
    );
    return this.streamAudioAsset(asset, response, 'private, no-store');
  }

  private mapAdminTopicSummary(topic: EnglishSpeakingTopicRecord) {
    const readySentenceCount = countReadyEnglishSpeakingSentences(topic);
    const sentenceCount = topic.sentences.length;

    return {
      accessType: topic.accessType,
      description: topic.description,
      id: topic.id,
      isReadyToPublish:
        sentenceCount > 0 && readySentenceCount === sentenceCount,
      orderIndex: topic.orderIndex,
      publishedAt: topic.publishedAt,
      readySentenceCount,
      sentenceCount,
      slug: topic.slug,
      status: topic.status,
      title: topic.title,
      updatedAt: topic.updatedAt,
      visibility: topic.visibility,
    };
  }

  private mapAdminTopicDetail(topic: EnglishSpeakingTopicRecord) {
    return {
      ...this.mapAdminTopicSummary(topic),
      createdAt: topic.createdAt,
      sentences: this.sortSentences(topic.sentences).map((sentence) => ({
        audioStates: ENGLISH_SPEAKING_AUDIO_LANGUAGES.map((language) =>
          this.mapAdminAudioState(sentence, language),
        ),
        englishText: sentence.englishText,
        hindiText: sentence.hindiText,
        id: sentence.id,
        marathiText: sentence.marathiText,
        orderIndex: sentence.orderIndex,
      })),
    };
  }

  private mapAdminAudioState(
    sentence: EnglishSpeakingSentenceRecord,
    language: EnglishSpeakingLanguage,
  ) {
    const record = findSentenceAudioRecord(sentence, language);
    const isCurrent =
      record && record.textHash
        ? isCurrentSentenceAudio(sentence, record)
        : false;

    return {
      finalizedAt: record?.finalizedAt ?? null,
      finalizedStreamPath: record?.finalizedFileAssetId
        ? `/admin/english-speaking/sentences/${encodeURIComponent(sentence.id)}/audio/${encodeURIComponent(language)}/final`
        : null,
      generatedAt: record?.generatedAt ?? null,
      hasFinalized: Boolean(record?.finalizedFileAssetId),
      hasPreview: Boolean(record?.previewFileAssetId),
      isCurrent,
      language,
      lastError: record?.lastError ?? null,
      modelId: record?.modelId ?? null,
      outputFormat: record?.outputFormat ?? null,
      previewStreamPath: record?.previewFileAssetId
        ? `/admin/english-speaking/sentences/${encodeURIComponent(sentence.id)}/audio/${encodeURIComponent(language)}/preview`
        : null,
      status: record?.status ?? EnglishSpeakingAudioStatus.NOT_GENERATED,
      voiceId: record?.voiceId ?? null,
    };
  }

  private mapStudentTopicSummary(
    topic: EnglishSpeakingTopicRecord,
    hasPremiumAccess: boolean,
  ) {
    return {
      accessMode: this.resolveStudentAccessMode(
        topic.accessType,
        hasPremiumAccess,
      ),
      accessType: topic.accessType,
      description: topic.description,
      id: topic.id,
      publishedAt: topic.publishedAt,
      sentenceCount: topic.sentences.length,
      slug: topic.slug,
      title: topic.title,
      updatedAt: topic.updatedAt,
    };
  }

  private mapStudentTopicDetail(
    topic: EnglishSpeakingTopicRecord,
    hasPremiumAccess: boolean,
  ) {
    const accessMode = this.resolveStudentAccessMode(
      topic.accessType,
      hasPremiumAccess,
    );

    return {
      ...this.mapStudentTopicSummary(topic, hasPremiumAccess),
      accessMode,
      sentences:
        accessMode === StudentEnglishSpeakingTopicAccessMode.LOCKED
          ? []
          : this.sortSentences(topic.sentences).map((sentence) => ({
              audioTracks: ENGLISH_SPEAKING_AUDIO_LANGUAGES.flatMap(
                (language) => {
                  const record = findSentenceAudioRecord(sentence, language);

                  if (
                    !record?.finalizedFileAssetId ||
                    !record.textHash ||
                    !isCurrentSentenceAudio(sentence, record)
                  ) {
                    return [];
                  }

                  return [
                    {
                      language,
                      streamPath: `/english-speaking/sentences/${encodeURIComponent(sentence.id)}/audio/${encodeURIComponent(language)}`,
                    },
                  ];
                },
              ),
              englishText: sentence.englishText,
              hindiText: sentence.hindiText,
              id: sentence.id,
              marathiText: sentence.marathiText,
              orderIndex: sentence.orderIndex,
            })),
    };
  }

  private resolveStudentAccessMode(
    accessType: ContentAccessType,
    hasPremiumAccess: boolean,
  ) {
    if (accessType === ContentAccessType.PREMIUM && !hasPremiumAccess) {
      return StudentEnglishSpeakingTopicAccessMode.LOCKED;
    }

    return StudentEnglishSpeakingTopicAccessMode.FULL;
  }

  private buildAdminTopicWhere(
    siteId: string,
    query: ListAdminEnglishSpeakingQueryDto,
  ): Prisma.EnglishSpeakingTopicWhereInput {
    const trimmedSearch = query.search?.trim();

    return {
      accessType: query.accessType,
      siteId,
      status: query.status,
      visibility: query.visibility,
      ...(trimmedSearch
        ? {
            OR: [
              {
                title: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
              {
                slug: {
                  contains: trimmedSearch,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildStudentTopicWhere(
    siteId: string,
  ): Prisma.EnglishSpeakingTopicWhereInput {
    return {
      OR: [
        {
          publishedAt: null,
        },
        {
          publishedAt: {
            lte: new Date(),
          },
        },
      ],
      siteId,
      status: ContentStatus.PUBLISHED,
      visibility: {
        in: [CatalogVisibility.PUBLIC, CatalogVisibility.AUTHENTICATED],
      },
    };
  }

  private async getAdminTopicRecord(siteId: string, topicId: string) {
    const topic = await this.prisma.englishSpeakingTopic.findFirst({
      where: {
        id: topicId,
        siteId,
      },
      select: englishSpeakingTopicSelect,
    });

    if (!topic) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_TOPIC_NOT_FOUND',
        message: 'English speaking topic was not found.',
      });
    }

    return topic;
  }

  private async ensureAdminTopicExists(siteId: string, topicId: string) {
    const topic = await this.prisma.englishSpeakingTopic.findFirst({
      where: {
        id: topicId,
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (!topic) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_TOPIC_NOT_FOUND',
        message: 'English speaking topic was not found.',
      });
    }

    return topic;
  }

  private async getAdminSentenceContext(siteId: string, sentenceId: string) {
    const sentence = await this.prisma.englishSpeakingSentence.findFirst({
      where: {
        id: sentenceId,
        topic: {
          siteId,
        },
      },
      select: adminSentenceContextSelect,
    });

    if (!sentence) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_SENTENCE_NOT_FOUND',
        message: 'English speaking sentence was not found.',
      });
    }

    return sentence;
  }

  private assertTopicReadyForPublish(topic: EnglishSpeakingTopicRecord) {
    const readySentenceCount = countReadyEnglishSpeakingSentences(topic);

    this.assertTopicHasSentences(topic);

    if (readySentenceCount !== topic.sentences.length) {
      throw new BadRequestException({
        code: 'ENGLISH_SPEAKING_AUDIO_INCOMPLETE',
        message:
          'Finalize current audio for every sentence in Hindi, Marathi, and English before publishing this topic.',
        details: {
          readySentenceCount,
          sentenceCount: topic.sentences.length,
        },
      });
    }
  }

  private assertTopicHasSentences(
    topic: Pick<EnglishSpeakingTopicRecord, 'sentences'>,
  ) {
    if (topic.sentences.length === 0) {
      throw new BadRequestException({
        code: 'ENGLISH_SPEAKING_SENTENCES_REQUIRED',
        message:
          'Add at least one sentence before generating audio or publishing an English speaking topic.',
      });
    }
  }

  private normalizeSentenceInputs(
    sentences: UpsertEnglishSpeakingSentenceDto[],
  ) {
    const normalized = sentences.map<NormalizedSentenceInput>(
      (sentence, index) => ({
        englishText: this.requireSentenceText(
          sentence.englishText,
          'englishText',
        ),
        hindiText: this.requireSentenceText(sentence.hindiText, 'hindiText'),
        id: sentence.id?.trim() || undefined,
        marathiText: this.requireSentenceText(
          sentence.marathiText,
          'marathiText',
        ),
        orderIndex: sentence.orderIndex ?? (index + 1) * 10,
      }),
    );
    const ids = normalized
      .map((sentence) => sentence.id)
      .filter((value): value is string => Boolean(value));

    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: 'ENGLISH_SPEAKING_SENTENCE_IDS_DUPLICATED',
        message: 'Sentence ids must be unique within a topic update payload.',
      });
    }

    return normalized;
  }

  private requireSentenceText(value: string, field: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException({
        code: 'ENGLISH_SPEAKING_SENTENCE_TEXT_REQUIRED',
        message: `${field} is required for every sentence.`,
      });
    }

    return normalized;
  }

  private async syncSentences(
    tx: Prisma.TransactionClient,
    existingSentences: EnglishSpeakingSentenceRecord[],
    topicId: string,
    nextSentences: NormalizedSentenceInput[],
  ) {
    const existingById = new Map(
      existingSentences.map((sentence) => [sentence.id, sentence]),
    );
    const retainedIds = new Set<string>();

    for (const sentence of nextSentences) {
      if (sentence.id) {
        const existing = existingById.get(sentence.id);

        if (!existing) {
          throw new BadRequestException({
            code: 'ENGLISH_SPEAKING_SENTENCE_NOT_FOUND',
            message:
              'One or more sentence ids do not belong to this English speaking topic.',
          });
        }

        retainedIds.add(sentence.id);
        await tx.englishSpeakingSentence.update({
          where: {
            id: sentence.id,
          },
          data: {
            englishText: sentence.englishText,
            hindiText: sentence.hindiText,
            marathiText: sentence.marathiText,
            orderIndex: sentence.orderIndex,
          },
        });
        continue;
      }

      await tx.englishSpeakingSentence.create({
        data: {
          englishText: sentence.englishText,
          hindiText: sentence.hindiText,
          marathiText: sentence.marathiText,
          orderIndex: sentence.orderIndex,
          topicId,
        },
      });
    }

    const deletedIds = existingSentences
      .map((sentence) => sentence.id)
      .filter((id) => !retainedIds.has(id));

    if (deletedIds.length > 0) {
      await tx.englishSpeakingSentence.deleteMany({
        where: {
          id: {
            in: deletedIds,
          },
        },
      });
    }
  }

  private hasSentenceMutation(
    existingSentences: EnglishSpeakingSentenceRecord[],
    nextSentences: NormalizedSentenceInput[],
  ) {
    if (existingSentences.length !== nextSentences.length) {
      return true;
    }

    const existingById = new Map(
      existingSentences.map((sentence) => [sentence.id, sentence]),
    );

    return nextSentences.some((sentence) => {
      if (!sentence.id) {
        return true;
      }

      const existing = existingById.get(sentence.id);

      if (!existing) {
        return true;
      }

      return (
        existing.orderIndex !== sentence.orderIndex ||
        existing.hindiText !== sentence.hindiText ||
        existing.marathiText !== sentence.marathiText ||
        existing.englishText !== sentence.englishText
      );
    });
  }

  private collectDeletedAssetIds(
    existingSentences: EnglishSpeakingSentenceRecord[],
    nextSentences: NormalizedSentenceInput[],
  ) {
    const retainedIds = new Set(
      nextSentences
        .map((sentence) => sentence.id)
        .filter((value): value is string => Boolean(value)),
    );
    const assetIds = new Set<string>();

    for (const sentence of existingSentences) {
      if (retainedIds.has(sentence.id)) {
        continue;
      }

      for (const record of sentence.audioRecords) {
        if (record.previewFileAssetId) {
          assetIds.add(record.previewFileAssetId);
        }
        if (record.finalizedFileAssetId) {
          assetIds.add(record.finalizedFileAssetId);
        }
      }
    }

    return Array.from(assetIds);
  }

  private normalizeLanguages(languages?: EnglishSpeakingLanguage[]) {
    if (!languages || languages.length === 0) {
      return [...ENGLISH_SPEAKING_AUDIO_LANGUAGES];
    }

    return Array.from(new Set(languages));
  }

  private async generateAudioPreviewsForSentence(
    user: AuthenticatedUser,
    sentence: AdminSentenceContextRecord,
    languages: EnglishSpeakingLanguage[],
  ) {
    for (const language of languages) {
      const text = getSentenceText(sentence, language).trim();

      if (!text) {
        throw new BadRequestException({
          code: 'ENGLISH_SPEAKING_TEXT_REQUIRED',
          message:
            'Each selected language must have a sentence before audio generation can start.',
          details: {
            language,
          },
        });
      }

      const settings =
        await this.englishSpeakingSettingsService.getGenerationConfig(
          sentence.topic.siteId,
          language,
        );
      const generatedBuffer = await this.elevenLabsTtsService.generateSpeech({
        languageCode: settings.languageCode,
        modelId: settings.modelId,
        outputFormat: settings.outputFormat,
        text,
        voiceId: settings.voiceId,
        voiceSettings: settings.voiceSettings,
      });
      const existingRecord = findSentenceAudioRecord(sentence, language);
      const previewAsset = await this.createAudioAsset({
        accessLevel: FileAssetAccess.ADMIN_ONLY,
        actorUserId: user.userId,
        audioBuffer: generatedBuffer,
        language,
        sentence,
      });

      await this.prisma.englishSpeakingSentenceAudio.upsert({
        where: {
          sentenceId_language: {
            language,
            sentenceId: sentence.id,
          },
        },
        update: {
          generatedAt: new Date(),
          lastError: null,
          modelId: settings.modelId,
          outputFormat: settings.outputFormat,
          previewFileAssetId: previewAsset.id,
          status: EnglishSpeakingAudioStatus.PREVIEW_READY,
          textHash: hashEnglishSpeakingText(text),
          voiceId: settings.voiceId,
        },
        create: {
          generatedAt: new Date(),
          language,
          modelId: settings.modelId,
          outputFormat: settings.outputFormat,
          previewFileAssetId: previewAsset.id,
          sentenceId: sentence.id,
          status: EnglishSpeakingAudioStatus.PREVIEW_READY,
          textHash: hashEnglishSpeakingText(text),
          voiceId: settings.voiceId,
        },
      });

      if (
        existingRecord?.previewFileAssetId &&
        existingRecord.previewFileAssetId !== previewAsset.id
      ) {
        await this.revokeAudioAssets(user.siteId, [
          existingRecord.previewFileAssetId,
        ]);
      }
    }
  }

  private async finalizeAudioForSentence(
    user: AuthenticatedUser,
    sentence: AdminSentenceContextRecord,
    languages: EnglishSpeakingLanguage[],
  ) {
    const revokedAssetIds: string[] = [];

    for (const language of languages) {
      const audioRecord = this.assertPreviewReadyForFinalize(
        sentence,
        language,
      );
      const previewFileAssetId = audioRecord.previewFileAssetId;

      await this.prisma.$transaction(async (tx) => {
        await tx.fileAsset.update({
          where: {
            id: previewFileAssetId,
          },
          data: {
            accessLevel: FileAssetAccess.PROTECTED,
          },
        });

        await tx.englishSpeakingSentenceAudio.update({
          where: {
            sentenceId_language: {
              language,
              sentenceId: sentence.id,
            },
          },
          data: {
            finalizedAt: new Date(),
            finalizedFileAssetId: previewFileAssetId,
            previewFileAssetId: null,
            status: EnglishSpeakingAudioStatus.FINALIZED,
          },
        });
      });

      if (
        audioRecord.finalizedFileAssetId &&
        audioRecord.finalizedFileAssetId !== previewFileAssetId
      ) {
        revokedAssetIds.push(audioRecord.finalizedFileAssetId);
      }
    }

    if (revokedAssetIds.length > 0) {
      await this.revokeAudioAssets(user.siteId, revokedAssetIds);
    }
  }

  private assertPreviewReadyForFinalize(
    sentence: AdminSentenceContextRecord,
    language: EnglishSpeakingLanguage,
  ) {
    const audioRecord = findSentenceAudioRecord(sentence, language);
    const currentTextHash = hashEnglishSpeakingText(
      getSentenceText(sentence, language),
    );

    if (!audioRecord?.previewFileAssetId) {
      throw new BadRequestException({
        code: 'ENGLISH_SPEAKING_PREVIEW_REQUIRED',
        message:
          'Generate a preview first before finalizing the selected sentence audio.',
        details: {
          language,
        },
      });
    }

    if (audioRecord.textHash !== currentTextHash) {
      throw new BadRequestException({
        code: 'ENGLISH_SPEAKING_PREVIEW_STALE',
        message:
          'The preview no longer matches the current sentence text. Regenerate the preview before finalizing it.',
        details: {
          language,
        },
      });
    }

    return {
      ...audioRecord,
      previewFileAssetId: audioRecord.previewFileAssetId,
    };
  }

  private async createAudioAsset(input: {
    accessLevel: FileAssetAccess;
    actorUserId: string;
    audioBuffer: Buffer;
    language: EnglishSpeakingLanguage;
    sentence: AdminSentenceContextRecord;
  }) {
    await this.objectStorageService.assertBucketReachable();

    const objectKey = this.buildAudioObjectKey(
      input.sentence.topic.site.code,
      input.language,
    );
    const fileName = this.buildAudioFileName(
      input.sentence.topic.slug,
      input.sentence.orderIndex,
      input.language,
    );
    const metadata = await this.objectStorageService.writeObject({
      body: input.audioBuffer,
      contentType: ENGLISH_SPEAKING_AUDIO_CONTENT_TYPE,
      objectKey,
    });

    return this.prisma.fileAsset.create({
      data: {
        accessLevel: input.accessLevel,
        confirmedAt: new Date(),
        confirmedByUserId: input.actorUserId,
        contentType: ENGLISH_SPEAKING_AUDIO_CONTENT_TYPE,
        createdByUserId: input.actorUserId,
        declaredSizeBytes: input.audioBuffer.length,
        etag: metadata.eTag,
        extension: ENGLISH_SPEAKING_AUDIO_EXTENSION,
        objectKey,
        originalFileName: fileName,
        purpose: FileAssetPurpose.CONTENT_AUDIO,
        siteId: input.sentence.topic.siteId,
        sizeBytes: metadata.contentLength ?? input.audioBuffer.length,
        status: FileAssetStatus.READY,
      },
      select: {
        id: true,
      },
    });
  }

  private async revokeAudioAssets(siteId: string, assetIds: string[]) {
    const uniqueIds = Array.from(new Set(assetIds));

    if (uniqueIds.length === 0) {
      return;
    }

    const assets = await this.prisma.fileAsset.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
        siteId,
      },
      select: {
        id: true,
        objectKey: true,
        status: true,
      },
    });

    for (const asset of assets) {
      if (asset.status === FileAssetStatus.REVOKED) {
        continue;
      }

      await this.prisma.fileAsset.update({
        where: {
          id: asset.id,
        },
        data: {
          status: FileAssetStatus.REVOKED,
        },
      });

      try {
        await this.objectStorageService.removeObject(asset.objectKey);
      } catch {
        // Intentionally ignore storage cleanup errors so admin editing is not blocked by missing objects.
      }
    }
  }

  private async getAudioAsset(siteId: string, assetId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId,
        status: FileAssetStatus.READY,
      },
      select: {
        contentType: true,
        id: true,
        objectKey: true,
      },
    });

    if (!asset) {
      throw new NotFoundException({
        code: 'ENGLISH_SPEAKING_AUDIO_NOT_FOUND',
        message: 'The requested English speaking audio asset was not found.',
      });
    }

    return asset;
  }

  private async streamAudioAsset(
    asset: {
      contentType: string;
      id: string;
      objectKey: string;
    },
    response: Response,
    cacheControl: string,
  ) {
    const object = await this.objectStorageService.readObject(asset.objectKey);

    response.setHeader('Cache-Control', cacheControl);
    response.setHeader('Content-Type', object.contentType ?? asset.contentType);
    if (object.contentLength !== null) {
      response.setHeader('Content-Length', String(object.contentLength));
    }
    if (object.eTag) {
      response.setHeader('ETag', object.eTag);
    }
    if (object.lastModified) {
      response.setHeader('Last-Modified', object.lastModified.toUTCString());
    }

    return new StreamableFile(object.body);
  }

  private buildAudioObjectKey(
    siteCode: string,
    language: EnglishSpeakingLanguage,
  ) {
    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const objectId = randomUUID();

    return [
      'sites',
      siteCode,
      'content_audio',
      year,
      month,
      `${language.toLowerCase()}-${objectId}.${ENGLISH_SPEAKING_AUDIO_EXTENSION}`,
    ].join('/');
  }

  private buildAudioFileName(
    topicSlug: string,
    orderIndex: number,
    language: EnglishSpeakingLanguage,
  ) {
    const languageLabel = ENGLISH_SPEAKING_LANGUAGE_CONFIG[language].fileLabel;
    return `${topicSlug}-${String(orderIndex).padStart(3, '0')}-${languageLabel}.${ENGLISH_SPEAKING_AUDIO_EXTENSION}`;
  }

  private async getNextTopicOrderIndex(siteId: string) {
    const aggregate = await this.prisma.englishSpeakingTopic.aggregate({
      where: {
        siteId,
      },
      _max: {
        orderIndex: true,
      },
    });

    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private resolveSlug(slug: string | undefined, title: string) {
    const normalized = slugifyContentValue(slug ?? title);

    if (!normalized) {
      throw new BadRequestException({
        code: 'ENGLISH_SPEAKING_SLUG_INVALID',
        message: 'Topic slug could not be resolved from the provided value.',
      });
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | undefined) {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private sortSentences(sentences: EnglishSpeakingSentenceRecord[]) {
    return [...sentences].sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
  }

  private collectTopicAssetIds(topic: EnglishSpeakingTopicRecord) {
    const assetIds = new Set<string>();

    for (const sentence of topic.sentences) {
      for (const record of sentence.audioRecords) {
        if (record.previewFileAssetId) {
          assetIds.add(record.previewFileAssetId);
        }
        if (record.finalizedFileAssetId) {
          assetIds.add(record.finalizedFileAssetId);
        }
      }
    }

    return Array.from(assetIds);
  }
}
