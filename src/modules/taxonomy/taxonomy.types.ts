import { Prisma } from '@prisma/client';

export const examTrackSelect = Prisma.validator<Prisma.ExamTrackSelect>()({
  id: true,
  siteId: true,
  code: true,
  slug: true,
  name: true,
  shortName: true,
  defaultMediumId: true,
  description: true,
  orderIndex: true,
  visibility: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export const mediumSelect = Prisma.validator<Prisma.MediumSelect>()({
  id: true,
  siteId: true,
  code: true,
  slug: true,
  name: true,
  description: true,
  orderIndex: true,
  visibility: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export const subjectSelect = Prisma.validator<Prisma.SubjectSelect>()({
  id: true,
  siteId: true,
  examTrackId: true,
  code: true,
  slug: true,
  name: true,
  description: true,
  orderIndex: true,
  visibility: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export const topicSelect = Prisma.validator<Prisma.TopicSelect>()({
  id: true,
  siteId: true,
  subjectId: true,
  parentId: true,
  code: true,
  slug: true,
  name: true,
  description: true,
  orderIndex: true,
  visibility: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export const tagSelect = Prisma.validator<Prisma.TagSelect>()({
  id: true,
  siteId: true,
  code: true,
  slug: true,
  name: true,
  description: true,
  orderIndex: true,
  visibility: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export type ExamTrackRecord = Prisma.ExamTrackGetPayload<{
  select: typeof examTrackSelect;
}>;

export type MediumRecord = Prisma.MediumGetPayload<{
  select: typeof mediumSelect;
}>;

export type SubjectRecord = Prisma.SubjectGetPayload<{
  select: typeof subjectSelect;
}>;

export type TopicRecord = Prisma.TopicGetPayload<{
  select: typeof topicSelect;
}>;

export type TagRecord = Prisma.TagGetPayload<{
  select: typeof tagSelect;
}>;

export function mapExamTrack(record: ExamTrackRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    code: record.code,
    slug: record.slug,
    name: record.name,
    shortName: record.shortName,
    defaultMediumId: record.defaultMediumId,
    description: record.description,
    orderIndex: record.orderIndex,
    visibility: record.visibility,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapMedium(record: MediumRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    code: record.code,
    slug: record.slug,
    name: record.name,
    description: record.description,
    orderIndex: record.orderIndex,
    visibility: record.visibility,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapSubject(record: SubjectRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    examTrackId: record.examTrackId,
    code: record.code,
    slug: record.slug,
    name: record.name,
    description: record.description,
    orderIndex: record.orderIndex,
    visibility: record.visibility,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapTopic(record: TopicRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    subjectId: record.subjectId,
    parentId: record.parentId,
    code: record.code,
    slug: record.slug,
    name: record.name,
    description: record.description,
    orderIndex: record.orderIndex,
    visibility: record.visibility,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapTag(record: TagRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    code: record.code,
    slug: record.slug,
    name: record.name,
    description: record.description,
    orderIndex: record.orderIndex,
    visibility: record.visibility,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
