import { Prisma } from '@prisma/client';
import { buildQuestionStatementPreviewText } from './questions.utils';

export const questionAssetSelect = Prisma.validator<Prisma.FileAssetSelect>()({
  id: true,
  purpose: true,
  accessLevel: true,
  status: true,
  originalFileName: true,
  contentType: true,
  sizeBytes: true,
});

export const questionOptionSelect =
  Prisma.validator<Prisma.QuestionOptionSelect>()({
    id: true,
    optionKey: true,
    orderIndex: true,
    contentJson: true,
    metaJson: true,
    createdAt: true,
    updatedAt: true,
  });

export const questionMediaReferenceSelect =
  Prisma.validator<Prisma.QuestionMediaReferenceSelect>()({
    id: true,
    fileAssetId: true,
    usage: true,
    optionKey: true,
    localeCode: true,
    orderIndex: true,
    createdAt: true,
    updatedAt: true,
    fileAsset: {
      select: questionAssetSelect,
    },
  });

export const questionSelect = Prisma.validator<Prisma.QuestionSelect>()({
  id: true,
  siteId: true,
  code: true,
  mediumId: true,
  subjectId: true,
  topicId: true,
  type: true,
  difficulty: true,
  statementJson: true,
  explanationJson: true,
  metadataJson: true,
  correctAnswerJson: true,
  searchText: true,
  hasMedia: true,
  status: true,
  createdByUserId: true,
  updatedByUserId: true,
  publishedByUserId: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  medium: {
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
    },
  },
  subject: {
    select: {
      id: true,
      examTrackId: true,
      code: true,
      slug: true,
      name: true,
      examTrack: {
        select: {
          id: true,
          code: true,
          slug: true,
          name: true,
        },
      },
    },
  },
  topic: {
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
    },
  },
  options: {
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: questionOptionSelect,
  },
  mediaReferences: {
    orderBy: [{ usage: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: questionMediaReferenceSelect,
  },
});

export type QuestionRecord = Prisma.QuestionGetPayload<{
  select: typeof questionSelect;
}>;

export function mapQuestionAsset(
  record: Prisma.FileAssetGetPayload<{ select: typeof questionAssetSelect }>,
) {
  return {
    id: record.id,
    purpose: record.purpose,
    accessLevel: record.accessLevel,
    status: record.status,
    originalFileName: record.originalFileName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    publicDeliveryPath: `/public/assets/${record.id}`,
    protectedDeliveryPath: `/assets/${record.id}`,
  };
}

export function mapQuestionSummary(record: QuestionRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    code: record.code,
    mediumId: record.mediumId,
    subjectId: record.subjectId,
    topicId: record.topicId,
    examTrackId: record.subject.examTrackId,
    type: record.type,
    difficulty: record.difficulty,
    statementPreviewText: buildQuestionStatementPreviewText(
      record.statementJson,
    ),
    hasMedia: record.hasMedia,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    optionCount: record.options.length,
    examTrack: record.subject.examTrack,
    medium: record.medium,
    subject: {
      id: record.subject.id,
      code: record.subject.code,
      slug: record.subject.slug,
      name: record.subject.name,
    },
    topic: record.topic,
  };
}

export function mapAdminQuestionDetail(record: QuestionRecord) {
  return {
    ...mapQuestionSummary(record),
    statementJson: record.statementJson,
    explanationJson: record.explanationJson,
    metadataJson: record.metadataJson,
    correctAnswerJson: record.correctAnswerJson,
    options: record.options,
    mediaReferences: record.mediaReferences.map((reference) => ({
      id: reference.id,
      fileAssetId: reference.fileAssetId,
      usage: reference.usage,
      optionKey: reference.optionKey,
      localeCode: reference.localeCode,
      orderIndex: reference.orderIndex,
      createdAt: reference.createdAt,
      updatedAt: reference.updatedAt,
      fileAsset: mapQuestionAsset(reference.fileAsset),
    })),
  };
}

export function mapStudentQuestionDetail(record: QuestionRecord) {
  return {
    ...mapQuestionSummary(record),
    statementJson: record.statementJson,
    metadataJson: record.metadataJson,
    options: record.options,
    mediaReferences: record.mediaReferences.map((reference) => ({
      id: reference.id,
      fileAssetId: reference.fileAssetId,
      usage: reference.usage,
      optionKey: reference.optionKey,
      localeCode: reference.localeCode,
      orderIndex: reference.orderIndex,
      fileAsset: mapQuestionAsset(reference.fileAsset),
    })),
  };
}
