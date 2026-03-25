import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CatalogVisibility } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  CreateExamTrackDto,
  CreateMediumDto,
  CreateSubjectDto,
  CreateTagDto,
  CreateTopicDto,
  ReorderTaxonomyDto,
  UpdateExamTrackDto,
  UpdateMediumDto,
  UpdateSubjectDto,
  UpdateTagDto,
  UpdateTopicDto,
} from './dto/manage-taxonomy.dto';
import {
  examTrackSelect,
  mapExamTrack,
  mapMedium,
  mapSubject,
  mapTag,
  mapTopic,
  mediumSelect,
  subjectSelect,
  tagSelect,
  topicSelect,
} from './taxonomy.types';

type TopicTreeNode = ReturnType<typeof mapTopic> & {
  children: TopicTreeNode[];
};

@Injectable()
export class TaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  async getPublicCatalog(siteCode?: string) {
    return this.getCatalogByVisibility(siteCode, [CatalogVisibility.PUBLIC]);
  }

  async getAuthenticatedCatalog(siteId: string) {
    return this.getCatalogSnapshot(siteId, [
      CatalogVisibility.PUBLIC,
      CatalogVisibility.AUTHENTICATED,
    ]);
  }

  async listExamTracks(siteId: string) {
    return this.prisma.examTrack.findMany({
      where: { siteId },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      select: examTrackSelect,
    });
  }

  async createExamTrack(siteId: string, input: CreateExamTrackDto) {
    const record = await this.prisma.examTrack.create({
      data: {
        siteId,
        code: this.resolveCode(input.code, input.name),
        slug: this.resolveSlug(input.slug, input.name),
        name: input.name.trim(),
        shortName: input.shortName?.trim() || null,
        description: input.description?.trim() || null,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        isActive: input.isActive ?? true,
        orderIndex:
          input.orderIndex ?? (await this.getNextExamTrackOrderIndex(siteId)),
      },
      select: examTrackSelect,
    });

    return mapExamTrack(record);
  }

  async updateExamTrack(siteId: string, examTrackId: string, input: UpdateExamTrackDto) {
    await this.ensureExamTrackExists(siteId, examTrackId);

    const record = await this.prisma.examTrack.update({
      where: { id: examTrackId },
      data: {
        code:
          input.code === undefined
            ? undefined
            : this.resolveCode(input.code, input.name),
        slug:
          input.slug === undefined
            ? undefined
            : this.resolveSlug(input.slug, input.name),
        name: input.name?.trim(),
        shortName:
          input.shortName === undefined ? undefined : input.shortName?.trim() || null,
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim() || null,
        visibility: input.visibility,
        isActive: input.isActive,
        orderIndex: input.orderIndex,
      },
      select: examTrackSelect,
    });

    return mapExamTrack(record);
  }

  async reorderExamTracks(siteId: string, input: ReorderTaxonomyDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id) => {
        const record = await this.prisma.examTrack.findFirst({
          where: { id, siteId },
          select: { id: true },
        });
        return Boolean(record);
      },
      (id, orderIndex) =>
        this.prisma.examTrack.update({
          where: { id },
          data: { orderIndex },
        }),
    );
  }

  async listMediums(siteId: string) {
    return this.prisma.medium.findMany({
      where: { siteId },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      select: mediumSelect,
    });
  }

  async createMedium(siteId: string, input: CreateMediumDto) {
    const record = await this.prisma.medium.create({
      data: {
        siteId,
        code: this.resolveCode(input.code, input.name),
        slug: this.resolveSlug(input.slug, input.name),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        isActive: input.isActive ?? true,
        orderIndex:
          input.orderIndex ?? (await this.getNextMediumOrderIndex(siteId)),
      },
      select: mediumSelect,
    });

    return mapMedium(record);
  }

  async updateMedium(siteId: string, mediumId: string, input: UpdateMediumDto) {
    await this.ensureMediumExists(siteId, mediumId);

    const record = await this.prisma.medium.update({
      where: { id: mediumId },
      data: {
        code:
          input.code === undefined
            ? undefined
            : this.resolveCode(input.code, input.name),
        slug:
          input.slug === undefined
            ? undefined
            : this.resolveSlug(input.slug, input.name),
        name: input.name?.trim(),
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim() || null,
        visibility: input.visibility,
        isActive: input.isActive,
        orderIndex: input.orderIndex,
      },
      select: mediumSelect,
    });

    return mapMedium(record);
  }

  async reorderMediums(siteId: string, input: ReorderTaxonomyDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id) => {
        const record = await this.prisma.medium.findFirst({
          where: { id, siteId },
          select: { id: true },
        });
        return Boolean(record);
      },
      (id, orderIndex) =>
        this.prisma.medium.update({
          where: { id },
          data: { orderIndex },
        }),
    );
  }

  async listSubjects(siteId: string, examTrackId?: string) {
    return this.prisma.subject.findMany({
      where: {
        siteId,
        examTrackId: examTrackId || undefined,
      },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      select: subjectSelect,
    });
  }

  async createSubject(siteId: string, input: CreateSubjectDto) {
    await this.ensureExamTrackExists(siteId, input.examTrackId);

    const record = await this.prisma.subject.create({
      data: {
        siteId,
        examTrackId: input.examTrackId,
        code: this.resolveCode(input.code, input.name),
        slug: this.resolveSlug(input.slug, input.name),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        isActive: input.isActive ?? true,
        orderIndex:
          input.orderIndex ??
          (await this.getNextSubjectOrderIndex(siteId, input.examTrackId)),
      },
      select: subjectSelect,
    });

    return mapSubject(record);
  }

  async updateSubject(siteId: string, subjectId: string, input: UpdateSubjectDto) {
    const existing = await this.ensureSubjectExists(siteId, subjectId);
    const nextExamTrackId = input.examTrackId ?? existing.examTrackId;

    await this.ensureExamTrackExists(siteId, nextExamTrackId);

    const record = await this.prisma.subject.update({
      where: { id: subjectId },
      data: {
        examTrackId: nextExamTrackId,
        code:
          input.code === undefined
            ? undefined
            : this.resolveCode(input.code, input.name),
        slug:
          input.slug === undefined
            ? undefined
            : this.resolveSlug(input.slug, input.name),
        name: input.name?.trim(),
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim() || null,
        visibility: input.visibility,
        isActive: input.isActive,
        orderIndex: input.orderIndex,
      },
      select: subjectSelect,
    });

    return mapSubject(record);
  }

  async reorderSubjects(siteId: string, input: ReorderTaxonomyDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id) => {
        const record = await this.prisma.subject.findFirst({
          where: { id, siteId },
          select: { id: true },
        });
        return Boolean(record);
      },
      (id, orderIndex) =>
        this.prisma.subject.update({
          where: { id },
          data: { orderIndex },
        }),
    );
  }

  async listTopics(siteId: string, subjectId?: string) {
    return this.prisma.topic.findMany({
      where: {
        siteId,
        subjectId: subjectId || undefined,
      },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      select: topicSelect,
    });
  }

  async createTopic(siteId: string, input: CreateTopicDto) {
    await this.ensureSubjectExists(siteId, input.subjectId);

    if (input.parentId) {
      await this.ensureParentTopic(siteId, input.subjectId, input.parentId);
    }

    const record = await this.prisma.topic.create({
      data: {
        siteId,
        subjectId: input.subjectId,
        parentId: input.parentId ?? null,
        code: this.resolveCode(input.code, input.name),
        slug: this.resolveSlug(input.slug, input.name),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        isActive: input.isActive ?? true,
        orderIndex:
          input.orderIndex ??
          (await this.getNextTopicOrderIndex(
            siteId,
            input.subjectId,
            input.parentId ?? null,
          )),
      },
      select: topicSelect,
    });

    return mapTopic(record);
  }

  async updateTopic(siteId: string, topicId: string, input: UpdateTopicDto) {
    const existing = await this.ensureTopicExists(siteId, topicId);
    const nextSubjectId = input.subjectId ?? existing.subjectId;
    const nextParentId =
      input.parentId === undefined ? existing.parentId : input.parentId;

    await this.ensureSubjectExists(siteId, nextSubjectId);

    if (nextParentId) {
      await this.ensureParentTopic(siteId, nextSubjectId, nextParentId, topicId);
      await this.assertTopicNotDescendant(topicId, nextParentId);
    }

    const record = await this.prisma.topic.update({
      where: { id: topicId },
      data: {
        subjectId: nextSubjectId,
        parentId: nextParentId ?? null,
        code:
          input.code === undefined
            ? undefined
            : this.resolveCode(input.code, input.name),
        slug:
          input.slug === undefined
            ? undefined
            : this.resolveSlug(input.slug, input.name),
        name: input.name?.trim(),
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim() || null,
        visibility: input.visibility,
        isActive: input.isActive,
        orderIndex: input.orderIndex,
      },
      select: topicSelect,
    });

    return mapTopic(record);
  }

  async reorderTopics(siteId: string, input: ReorderTaxonomyDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id) => {
        const record = await this.prisma.topic.findFirst({
          where: { id, siteId },
          select: { id: true },
        });
        return Boolean(record);
      },
      (id, orderIndex) =>
        this.prisma.topic.update({
          where: { id },
          data: { orderIndex },
        }),
    );
  }

  async listTags(siteId: string) {
    return this.prisma.tag.findMany({
      where: { siteId },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      select: tagSelect,
    });
  }

  async createTag(siteId: string, input: CreateTagDto) {
    const record = await this.prisma.tag.create({
      data: {
        siteId,
        code: this.resolveCode(input.code, input.name),
        slug: this.resolveSlug(input.slug, input.name),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        isActive: input.isActive ?? true,
        orderIndex:
          input.orderIndex ?? (await this.getNextTagOrderIndex(siteId)),
      },
      select: tagSelect,
    });

    return mapTag(record);
  }

  async updateTag(siteId: string, tagId: string, input: UpdateTagDto) {
    await this.ensureTagExists(siteId, tagId);

    const record = await this.prisma.tag.update({
      where: { id: tagId },
      data: {
        code:
          input.code === undefined
            ? undefined
            : this.resolveCode(input.code, input.name),
        slug:
          input.slug === undefined
            ? undefined
            : this.resolveSlug(input.slug, input.name),
        name: input.name?.trim(),
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim() || null,
        visibility: input.visibility,
        isActive: input.isActive,
        orderIndex: input.orderIndex,
      },
      select: tagSelect,
    });

    return mapTag(record);
  }

  async reorderTags(siteId: string, input: ReorderTaxonomyDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id) => {
        const record = await this.prisma.tag.findFirst({
          where: { id, siteId },
          select: { id: true },
        });
        return Boolean(record);
      },
      (id, orderIndex) =>
        this.prisma.tag.update({
          where: { id },
          data: { orderIndex },
        }),
    );
  }

  private async getCatalogByVisibility(
    siteCode: string | undefined,
    visibilities: CatalogVisibility[],
  ) {
    const snapshot = await this.siteSettingsService.getRuntimeSnapshot({
      siteCode,
      visibility: 'ALL',
    });

    return this.getCatalogSnapshot(snapshot.site.id, visibilities);
  }

  private async getCatalogSnapshot(
    siteId: string,
    visibilities: CatalogVisibility[],
  ) {
    const [examTracks, mediums, subjects, topics, tags] = await Promise.all([
      this.prisma.examTrack.findMany({
        where: {
          siteId,
          isActive: true,
          visibility: { in: visibilities },
        },
        orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        select: examTrackSelect,
      }),
      this.prisma.medium.findMany({
        where: {
          siteId,
          isActive: true,
          visibility: { in: visibilities },
        },
        orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        select: mediumSelect,
      }),
      this.prisma.subject.findMany({
        where: {
          siteId,
          isActive: true,
          visibility: { in: visibilities },
        },
        orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        select: subjectSelect,
      }),
      this.prisma.topic.findMany({
        where: {
          siteId,
          isActive: true,
          visibility: { in: visibilities },
        },
        orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        select: topicSelect,
      }),
      this.prisma.tag.findMany({
        where: {
          siteId,
          isActive: true,
          visibility: { in: visibilities },
        },
        orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        select: tagSelect,
      }),
    ]);
    const topicTreeBySubject = this.buildTopicTreeBySubject(
      topics.map((topic) => mapTopic(topic)),
    );

    return {
      examTracks: examTracks.map((record) => mapExamTrack(record)),
      mediums: mediums.map((record) => mapMedium(record)),
      subjects: subjects.map((record) => ({
        ...mapSubject(record),
        topics: topicTreeBySubject.get(record.id) ?? [],
      })),
      tags: tags.map((record) => mapTag(record)),
    };
  }

  private buildTopicTreeBySubject(topics: ReturnType<typeof mapTopic>[]) {
    const byId = new Map<string, TopicTreeNode>();
    const bySubject = new Map<string, TopicTreeNode[]>();

    for (const topic of topics) {
      byId.set(topic.id, {
        ...topic,
        children: [],
      });
    }

    for (const topic of byId.values()) {
      if (topic.parentId) {
        byId.get(topic.parentId)?.children.push(topic);
        continue;
      }

      const roots = bySubject.get(topic.subjectId) ?? [];
      roots.push(topic);
      bySubject.set(topic.subjectId, roots);
    }

    return bySubject;
  }

  private async reorderEntities(
    orderedIds: string[],
    exists: (id: string) => Promise<boolean>,
    update: (id: string, orderIndex: number) => Promise<unknown>,
  ) {
    const dedupedIds = Array.from(new Set(orderedIds));

    if (dedupedIds.length !== orderedIds.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_REORDER_IDS',
        message: 'Reorder input contains duplicate ids.',
      });
    }

    for (const id of dedupedIds) {
      if (!(await exists(id))) {
        throw new NotFoundException({
          code: 'TAXONOMY_RECORD_NOT_FOUND',
          message: `Taxonomy record "${id}" was not found.`,
        });
      }
    }

    for (const [index, id] of dedupedIds.entries()) {
      await update(id, (index + 1) * 10);
    }
  }

  private async ensureExamTrackExists(siteId: string, examTrackId: string) {
    const record = await this.prisma.examTrack.findFirst({
      where: { id: examTrackId, siteId },
      select: examTrackSelect,
    });

    if (!record) {
      throw new NotFoundException({
        code: 'EXAM_TRACK_NOT_FOUND',
        message: 'Exam track was not found.',
      });
    }

    return record;
  }

  private async ensureMediumExists(siteId: string, mediumId: string) {
    const record = await this.prisma.medium.findFirst({
      where: { id: mediumId, siteId },
      select: mediumSelect,
    });

    if (!record) {
      throw new NotFoundException({
        code: 'MEDIUM_NOT_FOUND',
        message: 'Medium was not found.',
      });
    }

    return record;
  }

  private async ensureSubjectExists(siteId: string, subjectId: string) {
    const record = await this.prisma.subject.findFirst({
      where: { id: subjectId, siteId },
      select: subjectSelect,
    });

    if (!record) {
      throw new NotFoundException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'Subject was not found.',
      });
    }

    return record;
  }

  private async ensureTopicExists(siteId: string, topicId: string) {
    const record = await this.prisma.topic.findFirst({
      where: { id: topicId, siteId },
      select: topicSelect,
    });

    if (!record) {
      throw new NotFoundException({
        code: 'TOPIC_NOT_FOUND',
        message: 'Topic was not found.',
      });
    }

    return record;
  }

  private async ensureTagExists(siteId: string, tagId: string) {
    const record = await this.prisma.tag.findFirst({
      where: { id: tagId, siteId },
      select: tagSelect,
    });

    if (!record) {
      throw new NotFoundException({
        code: 'TAG_NOT_FOUND',
        message: 'Tag was not found.',
      });
    }

    return record;
  }

  private async ensureParentTopic(
    siteId: string,
    subjectId: string,
    parentId: string,
    excludingTopicId?: string,
  ) {
    const parent = await this.prisma.topic.findFirst({
      where: {
        id: parentId,
        siteId,
        subjectId,
      },
      select: {
        id: true,
      },
    });

    if (!parent || parent.id === excludingTopicId) {
      throw new BadRequestException({
        code: 'INVALID_TOPIC_PARENT',
        message:
          'Parent topic must belong to the same subject and cannot reference the current topic.',
      });
    }
  }

  private async assertTopicNotDescendant(topicId: string, parentId: string) {
    let currentParentId: string | null = parentId;

    while (currentParentId) {
      if (currentParentId === topicId) {
        throw new BadRequestException({
          code: 'TOPIC_CYCLE_NOT_ALLOWED',
          message: 'Topic hierarchy cycles are not allowed.',
        });
      }

      const record = await this.prisma.topic.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      currentParentId = record?.parentId ?? null;
    }
  }

  private async getNextExamTrackOrderIndex(siteId: string) {
    const aggregate = await this.prisma.examTrack.aggregate({
      where: { siteId },
      _max: { orderIndex: true },
    });
    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private async getNextMediumOrderIndex(siteId: string) {
    const aggregate = await this.prisma.medium.aggregate({
      where: { siteId },
      _max: { orderIndex: true },
    });
    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private async getNextSubjectOrderIndex(siteId: string, examTrackId: string) {
    const aggregate = await this.prisma.subject.aggregate({
      where: { siteId, examTrackId },
      _max: { orderIndex: true },
    });
    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private async getNextTopicOrderIndex(
    siteId: string,
    subjectId: string,
    parentId: string | null,
  ) {
    const aggregate = await this.prisma.topic.aggregate({
      where: { siteId, subjectId, parentId },
      _max: { orderIndex: true },
    });
    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private async getNextTagOrderIndex(siteId: string) {
    const aggregate = await this.prisma.tag.aggregate({
      where: { siteId },
      _max: { orderIndex: true },
    });
    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private resolveCode(value: string | undefined, name: string | undefined) {
    const source = value ?? name;

    if (!source) {
      throw new BadRequestException({
        code: 'TAXONOMY_CODE_REQUIRED',
        message: 'A taxonomy code or name is required.',
      });
    }

    return this.slugify(source);
  }

  private resolveSlug(value: string | undefined, name: string | undefined) {
    const source = value ?? name;

    if (!source) {
      throw new BadRequestException({
        code: 'TAXONOMY_SLUG_REQUIRED',
        message: 'A taxonomy slug or name is required.',
      });
    }

    return this.slugify(source);
  }

  private slugify(value: string) {
    const normalized = value
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-');

    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_SLUG',
        message: 'The provided value cannot be converted into a valid slug.',
      });
    }

    return normalized;
  }
}
