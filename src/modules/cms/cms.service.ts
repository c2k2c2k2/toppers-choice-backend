import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogVisibility,
  CmsBannerPlacement,
  CmsRecordStatus,
  CmsSectionSurface,
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { CMS_RUNTIME_CONFIG_KEY } from './cms.constants';
import {
  CmsAnnouncementRecord,
  CmsBannerRecord,
  CmsPageRecord,
  CmsSectionRecord,
  buildCmsVisibilityWhere,
  cmsAnnouncementSelect,
  cmsBannerSelect,
  cmsPageSelect,
  cmsSectionSelect,
  mapCmsAnnouncement,
  mapCmsBanner,
  mapCmsPage,
  mapCmsSection,
} from './cms.types';
import {
  CreateCmsAnnouncementDto,
  CreateCmsBannerDto,
  CreateCmsPageDto,
  CreateCmsSectionDto,
  ListCmsRecordsQueryDto,
  PublishCmsRecordDto,
  ReorderCmsRecordsDto,
  UpdateCmsAnnouncementDto,
  UpdateCmsBannerDto,
  UpdateCmsPageDto,
  UpdateCmsSectionDto,
} from './dto/manage-cms.dto';
import { cmsSlugify } from './cms.utils';

type ResolverLimits = {
  pages: number;
  banners: number;
  announcements: number;
  sections: number;
};

type CmsImageAsset = {
  id: string;
  purpose: FileAssetPurpose;
  accessLevel: FileAssetAccess;
  status: FileAssetStatus;
};

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  async resolvePublicCms(siteId: string) {
    return this.resolveCmsBundle(siteId, false);
  }

  async resolveStudentCms(siteId: string) {
    return this.resolveCmsBundle(siteId, true);
  }

  async getPublicPage(siteId: string, slug: string) {
    return this.getPublishedPageBySlug(siteId, slug, false);
  }

  async getStudentPage(siteId: string, slug: string) {
    return this.getPublishedPageBySlug(siteId, slug, true);
  }

  async listAdminPages(siteId: string, query: ListCmsRecordsQueryDto) {
    const where: Prisma.CmsPageWhereInput = {
      siteId,
      status: query.status,
      visibility: query.visibility,
      OR: query.q
        ? [
            { title: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
            { summary: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsPage.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        select: cmsPageSelect,
      }),
      this.prisma.cmsPage.count({ where }),
    ]);

    return {
      items: items.map((item) => mapCmsPage(item)),
      total,
    };
  }

  async getAdminPage(siteId: string, pageId: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: {
        id: pageId,
        siteId,
      },
      select: cmsPageSelect,
    });

    if (!page) {
      throw this.notFound('CMS_PAGE_NOT_FOUND', 'CMS page was not found.');
    }

    return mapCmsPage(page, { includeBody: true });
  }

  async createPage(user: AuthenticatedUser, input: CreateCmsPageDto) {
    const slug = this.resolvePageSlug(input.slug, input.title);
    const coverImageAssetId =
      input.coverImageAssetId === undefined ? null : input.coverImageAssetId;
    await this.ensureImageAssetCompatible(
      user.siteId,
      coverImageAssetId,
      input.visibility ?? CatalogVisibility.PUBLIC,
    );

    const page = await this.prisma.cmsPage.create({
      data: {
        siteId: user.siteId,
        slug,
        title: input.title.trim(),
        summary: input.summary?.trim() ?? null,
        bodyJson: input.bodyJson as Prisma.InputJsonValue,
        seoJson:
          input.seoJson === undefined
            ? Prisma.DbNull
            : (input.seoJson as Prisma.InputJsonValue),
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        coverImageAssetId,
        orderIndex: input.orderIndex ?? (await this.getNextPageOrderIndex(user.siteId)),
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsPageSelect,
    });

    return mapCmsPage(page, { includeBody: true });
  }

  async updatePage(
    user: AuthenticatedUser,
    pageId: string,
    input: UpdateCmsPageDto,
  ) {
    const existing = await this.prisma.cmsPage.findFirst({
      where: {
        id: pageId,
        siteId: user.siteId,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        visibility: true,
        coverImageAssetId: true,
      },
    });

    if (!existing) {
      throw this.notFound('CMS_PAGE_NOT_FOUND', 'CMS page was not found.');
    }

    const nextTitle = input.title ?? existing.title;
    const nextSlug =
      input.slug === undefined && input.title === undefined
        ? existing.slug
        : this.resolvePageSlug(input.slug ?? existing.slug, nextTitle);
    const nextVisibility = input.visibility ?? existing.visibility;
    const nextCoverImageAssetId =
      input.coverImageAssetId === undefined
        ? existing.coverImageAssetId
        : (input.coverImageAssetId ?? null);

    await this.ensureImageAssetCompatible(
      user.siteId,
      nextCoverImageAssetId,
      nextVisibility,
    );

    const page = await this.prisma.cmsPage.update({
      where: {
        id: pageId,
      },
      data: {
        slug: nextSlug,
        title: input.title?.trim(),
        summary:
          input.summary === undefined ? undefined : input.summary?.trim() ?? null,
        bodyJson:
          input.bodyJson === undefined
            ? undefined
            : (input.bodyJson as Prisma.InputJsonValue),
        seoJson:
          input.seoJson === undefined
            ? undefined
            : input.seoJson === null
              ? Prisma.DbNull
              : (input.seoJson as Prisma.InputJsonValue),
        visibility: nextVisibility,
        coverImageAssetId: nextCoverImageAssetId,
        orderIndex: input.orderIndex,
        updatedByUserId: user.userId,
      },
      select: cmsPageSelect,
    });

    return mapCmsPage(page, { includeBody: true });
  }

  async publishPage(
    user: AuthenticatedUser,
    pageId: string,
    input: PublishCmsRecordDto,
  ) {
    const page = await this.prisma.cmsPage.update({
      where: {
        id: pageId,
      },
      data: {
        status: CmsRecordStatus.PUBLISHED,
        publishedAt: input.publishAt ? new Date(input.publishAt) : new Date(),
        archivedAt: null,
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsPageSelect,
    });

    return mapCmsPage(page, { includeBody: true });
  }

  async unpublishPage(user: AuthenticatedUser, pageId: string) {
    const page = await this.prisma.cmsPage.update({
      where: {
        id: pageId,
      },
      data: {
        status: CmsRecordStatus.DRAFT,
        publishedAt: null,
        updatedByUserId: user.userId,
      },
      select: cmsPageSelect,
    });

    return mapCmsPage(page, { includeBody: true });
  }

  async reorderPages(siteId: string, input: ReorderCmsRecordsDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id, orderIndex) =>
        this.prisma.cmsPage.updateMany({
          where: {
            id,
            siteId,
          },
          data: {
            orderIndex,
          },
        }),
    );
  }

  async listAdminBanners(siteId: string, query: ListCmsRecordsQueryDto) {
    const where: Prisma.CmsBannerWhereInput = {
      siteId,
      status: query.status,
      visibility: query.visibility,
      placement: query.placement,
      OR: query.q
        ? [
            { title: { contains: query.q, mode: 'insensitive' } },
            { subtitle: { contains: query.q, mode: 'insensitive' } },
            { body: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsBanner.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'desc' }],
        select: cmsBannerSelect,
      }),
      this.prisma.cmsBanner.count({ where }),
    ]);

    return {
      items: items.map((item) => mapCmsBanner(item)),
      total,
    };
  }

  async getAdminBanner(siteId: string, bannerId: string) {
    const banner = await this.prisma.cmsBanner.findFirst({
      where: {
        id: bannerId,
        siteId,
      },
      select: cmsBannerSelect,
    });

    if (!banner) {
      throw this.notFound('CMS_BANNER_NOT_FOUND', 'CMS banner was not found.');
    }

    return mapCmsBanner(banner);
  }

  async createBanner(user: AuthenticatedUser, input: CreateCmsBannerDto) {
    const imageAssetId =
      input.imageAssetId === undefined ? null : input.imageAssetId;
    await this.ensureImageAssetCompatible(
      user.siteId,
      imageAssetId,
      input.visibility ?? CatalogVisibility.PUBLIC,
    );

    const banner = await this.prisma.cmsBanner.create({
      data: {
        siteId: user.siteId,
        placement: input.placement,
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() ?? null,
        body: input.body?.trim() ?? null,
        ctaLabel: input.ctaLabel?.trim() ?? null,
        ctaHref: input.ctaHref?.trim() ?? null,
        imageAssetId,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        orderIndex:
          input.orderIndex ??
          (await this.getNextBannerOrderIndex(user.siteId, input.placement)),
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        metaJson:
          input.metaJson === undefined
            ? Prisma.DbNull
            : (input.metaJson as Prisma.InputJsonValue),
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsBannerSelect,
    });

    this.assertBannerDates(banner);
    return mapCmsBanner(banner);
  }

  async updateBanner(
    user: AuthenticatedUser,
    bannerId: string,
    input: UpdateCmsBannerDto,
  ) {
    const existing = await this.prisma.cmsBanner.findFirst({
      where: {
        id: bannerId,
        siteId: user.siteId,
      },
      select: {
        id: true,
        visibility: true,
        imageAssetId: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!existing) {
      throw this.notFound('CMS_BANNER_NOT_FOUND', 'CMS banner was not found.');
    }

    const nextVisibility = input.visibility ?? existing.visibility;
    const nextImageAssetId =
      input.imageAssetId === undefined
        ? existing.imageAssetId
        : (input.imageAssetId ?? null);
    await this.ensureImageAssetCompatible(
      user.siteId,
      nextImageAssetId,
      nextVisibility,
    );

    const banner = await this.prisma.cmsBanner.update({
      where: {
        id: bannerId,
      },
      data: {
        placement: input.placement,
        title: input.title?.trim(),
        subtitle:
          input.subtitle === undefined ? undefined : input.subtitle?.trim() ?? null,
        body: input.body === undefined ? undefined : input.body?.trim() ?? null,
        ctaLabel:
          input.ctaLabel === undefined
            ? undefined
            : input.ctaLabel?.trim() ?? null,
        ctaHref:
          input.ctaHref === undefined ? undefined : input.ctaHref?.trim() ?? null,
        imageAssetId: nextImageAssetId,
        visibility: nextVisibility,
        orderIndex: input.orderIndex,
        startsAt:
          input.startsAt === undefined
            ? undefined
            : input.startsAt
              ? new Date(input.startsAt)
              : null,
        endsAt:
          input.endsAt === undefined
            ? undefined
            : input.endsAt
              ? new Date(input.endsAt)
              : null,
        metaJson:
          input.metaJson === undefined
            ? undefined
            : input.metaJson === null
              ? Prisma.DbNull
              : (input.metaJson as Prisma.InputJsonValue),
        updatedByUserId: user.userId,
      },
      select: cmsBannerSelect,
    });

    this.assertBannerDates(banner);
    return mapCmsBanner(banner);
  }

  async publishBanner(
    user: AuthenticatedUser,
    bannerId: string,
    input: PublishCmsRecordDto,
  ) {
    const banner = await this.prisma.cmsBanner.update({
      where: {
        id: bannerId,
      },
      data: {
        status: CmsRecordStatus.PUBLISHED,
        publishedAt: input.publishAt ? new Date(input.publishAt) : new Date(),
        archivedAt: null,
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsBannerSelect,
    });

    return mapCmsBanner(banner);
  }

  async unpublishBanner(user: AuthenticatedUser, bannerId: string) {
    const banner = await this.prisma.cmsBanner.update({
      where: {
        id: bannerId,
      },
      data: {
        status: CmsRecordStatus.DRAFT,
        publishedAt: null,
        updatedByUserId: user.userId,
      },
      select: cmsBannerSelect,
    });

    return mapCmsBanner(banner);
  }

  async reorderBanners(siteId: string, input: ReorderCmsRecordsDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id, orderIndex) =>
        this.prisma.cmsBanner.updateMany({
          where: {
            id,
            siteId,
          },
          data: {
            orderIndex,
          },
        }),
    );
  }

  async listAdminAnnouncements(siteId: string, query: ListCmsRecordsQueryDto) {
    const where: Prisma.CmsAnnouncementWhereInput = {
      siteId,
      status: query.status,
      visibility: query.visibility,
      OR: query.q
        ? [
            { title: { contains: query.q, mode: 'insensitive' } },
            { body: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsAnnouncement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
        select: cmsAnnouncementSelect,
      }),
      this.prisma.cmsAnnouncement.count({ where }),
    ]);

    return {
      items: items.map((item) => mapCmsAnnouncement(item)),
      total,
    };
  }

  async getAdminAnnouncement(siteId: string, announcementId: string) {
    const announcement = await this.prisma.cmsAnnouncement.findFirst({
      where: {
        id: announcementId,
        siteId,
      },
      select: cmsAnnouncementSelect,
    });

    if (!announcement) {
      throw this.notFound(
        'CMS_ANNOUNCEMENT_NOT_FOUND',
        'CMS announcement was not found.',
      );
    }

    return mapCmsAnnouncement(announcement);
  }

  async createAnnouncement(
    user: AuthenticatedUser,
    input: CreateCmsAnnouncementDto,
  ) {
    const announcement = await this.prisma.cmsAnnouncement.create({
      data: {
        siteId: user.siteId,
        title: input.title.trim(),
        body: input.body.trim(),
        linkLabel: input.linkLabel?.trim() ?? null,
        linkHref: input.linkHref?.trim() ?? null,
        level: input.level,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        isPinned: input.isPinned ?? false,
        orderIndex: input.orderIndex ?? (await this.getNextAnnouncementOrderIndex(user.siteId)),
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        metaJson:
          input.metaJson === undefined
            ? Prisma.DbNull
            : (input.metaJson as Prisma.InputJsonValue),
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsAnnouncementSelect,
    });

    this.assertAnnouncementDates(announcement);
    return mapCmsAnnouncement(announcement);
  }

  async updateAnnouncement(
    user: AuthenticatedUser,
    announcementId: string,
    input: UpdateCmsAnnouncementDto,
  ) {
    const existing = await this.prisma.cmsAnnouncement.findFirst({
      where: {
        id: announcementId,
        siteId: user.siteId,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!existing) {
      throw this.notFound(
        'CMS_ANNOUNCEMENT_NOT_FOUND',
        'CMS announcement was not found.',
      );
    }

    const announcement = await this.prisma.cmsAnnouncement.update({
      where: {
        id: announcementId,
      },
      data: {
        title: input.title?.trim(),
        body: input.body?.trim(),
        linkLabel:
          input.linkLabel === undefined
            ? undefined
            : input.linkLabel?.trim() ?? null,
        linkHref:
          input.linkHref === undefined
            ? undefined
            : input.linkHref?.trim() ?? null,
        level: input.level,
        visibility: input.visibility,
        isPinned: input.isPinned,
        orderIndex: input.orderIndex,
        startsAt:
          input.startsAt === undefined
            ? undefined
            : input.startsAt
              ? new Date(input.startsAt)
              : null,
        endsAt:
          input.endsAt === undefined
            ? undefined
            : input.endsAt
              ? new Date(input.endsAt)
              : null,
        metaJson:
          input.metaJson === undefined
            ? undefined
            : input.metaJson === null
              ? Prisma.DbNull
              : (input.metaJson as Prisma.InputJsonValue),
        updatedByUserId: user.userId,
      },
      select: cmsAnnouncementSelect,
    });

    this.assertAnnouncementDates(announcement);
    return mapCmsAnnouncement(announcement);
  }

  async publishAnnouncement(
    user: AuthenticatedUser,
    announcementId: string,
    input: PublishCmsRecordDto,
  ) {
    const announcement = await this.prisma.cmsAnnouncement.update({
      where: {
        id: announcementId,
      },
      data: {
        status: CmsRecordStatus.PUBLISHED,
        publishedAt: input.publishAt ? new Date(input.publishAt) : new Date(),
        archivedAt: null,
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsAnnouncementSelect,
    });

    return mapCmsAnnouncement(announcement);
  }

  async unpublishAnnouncement(user: AuthenticatedUser, announcementId: string) {
    const announcement = await this.prisma.cmsAnnouncement.update({
      where: {
        id: announcementId,
      },
      data: {
        status: CmsRecordStatus.DRAFT,
        publishedAt: null,
        updatedByUserId: user.userId,
      },
      select: cmsAnnouncementSelect,
    });

    return mapCmsAnnouncement(announcement);
  }

  async reorderAnnouncements(siteId: string, input: ReorderCmsRecordsDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id, orderIndex) =>
        this.prisma.cmsAnnouncement.updateMany({
          where: {
            id,
            siteId,
          },
          data: {
            orderIndex,
          },
        }),
    );
  }

  async listAdminSections(siteId: string, query: ListCmsRecordsQueryDto) {
    const where: Prisma.CmsSectionWhereInput = {
      siteId,
      status: query.status,
      visibility: query.visibility,
      surface: query.surface,
      OR: query.q
        ? [
            { title: { contains: query.q, mode: 'insensitive' } },
            { subtitle: { contains: query.q, mode: 'insensitive' } },
            { code: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cmsSection.findMany({
        where,
        orderBy: [{ surface: 'asc' }, { orderIndex: 'asc' }, { title: 'asc' }],
        select: cmsSectionSelect,
      }),
      this.prisma.cmsSection.count({ where }),
    ]);

    return {
      items: items.map((item) => mapCmsSection(item)),
      total,
    };
  }

  async getAdminSection(siteId: string, sectionId: string) {
    const section = await this.prisma.cmsSection.findFirst({
      where: {
        id: sectionId,
        siteId,
      },
      select: cmsSectionSelect,
    });

    if (!section) {
      throw this.notFound('CMS_SECTION_NOT_FOUND', 'CMS section was not found.');
    }

    return mapCmsSection(section, { includeBody: true });
  }

  async createSection(user: AuthenticatedUser, input: CreateCmsSectionDto) {
    const imageAssetId =
      input.imageAssetId === undefined ? null : input.imageAssetId;
    await this.ensureImageAssetCompatible(
      user.siteId,
      imageAssetId,
      input.visibility ?? CatalogVisibility.PUBLIC,
    );

    const section = await this.prisma.cmsSection.create({
      data: {
        siteId: user.siteId,
        surface: input.surface,
        code: input.code,
        title: input.title.trim(),
        subtitle: input.subtitle?.trim() ?? null,
        type: input.type,
        bodyJson:
          input.bodyJson === undefined
            ? Prisma.DbNull
            : (input.bodyJson as Prisma.InputJsonValue),
        configJson:
          input.configJson === undefined
            ? Prisma.DbNull
            : (input.configJson as Prisma.InputJsonValue),
        imageAssetId,
        visibility: input.visibility ?? CatalogVisibility.PUBLIC,
        orderIndex:
          input.orderIndex ??
          (await this.getNextSectionOrderIndex(user.siteId, input.surface)),
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsSectionSelect,
    });

    return mapCmsSection(section, { includeBody: true });
  }

  async updateSection(
    user: AuthenticatedUser,
    sectionId: string,
    input: UpdateCmsSectionDto,
  ) {
    const existing = await this.prisma.cmsSection.findFirst({
      where: {
        id: sectionId,
        siteId: user.siteId,
      },
      select: {
        id: true,
        visibility: true,
        imageAssetId: true,
      },
    });

    if (!existing) {
      throw this.notFound('CMS_SECTION_NOT_FOUND', 'CMS section was not found.');
    }

    const nextVisibility = input.visibility ?? existing.visibility;
    const nextImageAssetId =
      input.imageAssetId === undefined
        ? existing.imageAssetId
        : (input.imageAssetId ?? null);
    await this.ensureImageAssetCompatible(
      user.siteId,
      nextImageAssetId,
      nextVisibility,
    );

    const section = await this.prisma.cmsSection.update({
      where: {
        id: sectionId,
      },
      data: {
        surface: input.surface,
        code: input.code,
        title: input.title?.trim(),
        subtitle:
          input.subtitle === undefined ? undefined : input.subtitle?.trim() ?? null,
        type: input.type,
        bodyJson:
          input.bodyJson === undefined
            ? undefined
            : input.bodyJson === null
              ? Prisma.DbNull
              : (input.bodyJson as Prisma.InputJsonValue),
        configJson:
          input.configJson === undefined
            ? undefined
            : input.configJson === null
              ? Prisma.DbNull
              : (input.configJson as Prisma.InputJsonValue),
        imageAssetId: nextImageAssetId,
        visibility: nextVisibility,
        orderIndex: input.orderIndex,
        updatedByUserId: user.userId,
      },
      select: cmsSectionSelect,
    });

    return mapCmsSection(section, { includeBody: true });
  }

  async publishSection(
    user: AuthenticatedUser,
    sectionId: string,
    input: PublishCmsRecordDto,
  ) {
    const section = await this.prisma.cmsSection.update({
      where: {
        id: sectionId,
      },
      data: {
        status: CmsRecordStatus.PUBLISHED,
        publishedAt: input.publishAt ? new Date(input.publishAt) : new Date(),
        archivedAt: null,
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      select: cmsSectionSelect,
    });

    return mapCmsSection(section, { includeBody: true });
  }

  async unpublishSection(user: AuthenticatedUser, sectionId: string) {
    const section = await this.prisma.cmsSection.update({
      where: {
        id: sectionId,
      },
      data: {
        status: CmsRecordStatus.DRAFT,
        publishedAt: null,
        updatedByUserId: user.userId,
      },
      select: cmsSectionSelect,
    });

    return mapCmsSection(section, { includeBody: true });
  }

  async reorderSections(siteId: string, input: ReorderCmsRecordsDto) {
    await this.reorderEntities(
      input.orderedIds,
      async (id, orderIndex) =>
        this.prisma.cmsSection.updateMany({
          where: {
            id,
            siteId,
          },
          data: {
            orderIndex,
          },
        }),
    );
  }

  private async resolveCmsBundle(siteId: string, includeAuthenticated: boolean) {
    const limits = await this.getResolverLimits();
    const visibilityFilter = buildCmsVisibilityWhere(includeAuthenticated);
    const now = new Date();
    const [pages, banners, announcements, sections] = await this.prisma.$transaction([
      this.prisma.cmsPage.findMany({
        where: {
          siteId,
          visibility: visibilityFilter,
          status: CmsRecordStatus.PUBLISHED,
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        take: limits.pages,
        select: cmsPageSelect,
      }),
      this.prisma.cmsBanner.findMany({
        where: {
          siteId,
          visibility: visibilityFilter,
          status: CmsRecordStatus.PUBLISHED,
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
          AND: this.buildActiveWindowFilters(now),
        },
        orderBy: [{ placement: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
        take: limits.banners,
        select: cmsBannerSelect,
      }),
      this.prisma.cmsAnnouncement.findMany({
        where: {
          siteId,
          visibility: visibilityFilter,
          status: CmsRecordStatus.PUBLISHED,
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
          AND: this.buildActiveWindowFilters(now),
        },
        orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
        take: limits.announcements,
        select: cmsAnnouncementSelect,
      }),
      this.prisma.cmsSection.findMany({
        where: {
          siteId,
          visibility: visibilityFilter,
          status: CmsRecordStatus.PUBLISHED,
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
        },
        orderBy: [{ surface: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
        take: limits.sections,
        select: cmsSectionSelect,
      }),
    ]);

    return {
      pages: pages.map((item) => mapCmsPage(item)),
      banners: banners.map((item) => mapCmsBanner(item)),
      announcements: announcements.map((item) => mapCmsAnnouncement(item)),
      sections: sections.map((item) => mapCmsSection(item)),
    };
  }

  private async getPublishedPageBySlug(
    siteId: string,
    slug: string,
    includeAuthenticated: boolean,
  ) {
    const page = await this.prisma.cmsPage.findFirst({
      where: {
        siteId,
        slug,
        visibility: buildCmsVisibilityWhere(includeAuthenticated),
        status: CmsRecordStatus.PUBLISHED,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
      select: cmsPageSelect,
    });

    if (!page) {
      throw this.notFound('CMS_PAGE_NOT_FOUND', 'CMS page was not found.');
    }

    return mapCmsPage(page, { includeBody: true });
  }

  private async ensureImageAssetCompatible(
    siteId: string,
    assetId: string | null,
    visibility: CatalogVisibility,
  ) {
    if (!assetId) {
      return;
    }

    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId,
      },
      select: {
        id: true,
        purpose: true,
        accessLevel: true,
        status: true,
      },
    });

    if (!asset) {
      throw this.notFound('CMS_ASSET_NOT_FOUND', 'CMS image asset was not found.');
    }

    if (asset.status !== FileAssetStatus.READY) {
      throw new BadRequestException({
        code: 'CMS_ASSET_NOT_READY',
        message: 'CMS image asset must be confirmed before it can be linked.',
      });
    }

    if (
      asset.purpose !== FileAssetPurpose.CMS_IMAGE &&
      asset.purpose !== FileAssetPurpose.GENERIC_IMAGE
    ) {
      throw new BadRequestException({
        code: 'CMS_ASSET_PURPOSE_INVALID',
        message: 'Only CMS or generic image assets can be linked to CMS records.',
      });
    }

    if (visibility === CatalogVisibility.PUBLIC && asset.accessLevel !== FileAssetAccess.PUBLIC) {
      throw new BadRequestException({
        code: 'CMS_ASSET_ACCESS_INVALID',
        message: 'Public CMS records require publicly readable image assets.',
      });
    }

    if (
      visibility === CatalogVisibility.AUTHENTICATED &&
      asset.accessLevel !== FileAssetAccess.PUBLIC &&
      asset.accessLevel !== FileAssetAccess.AUTHENTICATED
    ) {
      throw new BadRequestException({
        code: 'CMS_ASSET_ACCESS_INVALID',
        message:
          'Authenticated CMS records require public or authenticated image assets.',
      });
    }
  }

  private async getResolverLimits(): Promise<ResolverLimits> {
    const [pages, banners, announcements, sections] = await Promise.all([
      this.siteSettingsService.getNumberSetting(
        CMS_RUNTIME_CONFIG_KEY,
        'resolver.maxPages',
        {
          fallback: 8,
          min: 1,
          max: 50,
          integer: true,
        },
      ),
      this.siteSettingsService.getNumberSetting(
        CMS_RUNTIME_CONFIG_KEY,
        'resolver.maxBanners',
        {
          fallback: 8,
          min: 1,
          max: 50,
          integer: true,
        },
      ),
      this.siteSettingsService.getNumberSetting(
        CMS_RUNTIME_CONFIG_KEY,
        'resolver.maxAnnouncements',
        {
          fallback: 10,
          min: 1,
          max: 50,
          integer: true,
        },
      ),
      this.siteSettingsService.getNumberSetting(
        CMS_RUNTIME_CONFIG_KEY,
        'resolver.maxSections',
        {
          fallback: 12,
          min: 1,
          max: 50,
          integer: true,
        },
      ),
    ]);

    return {
      pages,
      banners,
      announcements,
      sections,
    };
  }

  private buildActiveWindowFilters(now: Date) {
    return [
      {
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      {
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    ];
  }

  private assertBannerDates(record: Pick<CmsBannerRecord, 'startsAt' | 'endsAt'>) {
    if (record.startsAt && record.endsAt && record.startsAt > record.endsAt) {
      throw new BadRequestException({
        code: 'CMS_BANNER_DATE_RANGE_INVALID',
        message: 'Banner start time must be earlier than end time.',
      });
    }
  }

  private assertAnnouncementDates(
    record: Pick<CmsAnnouncementRecord, 'startsAt' | 'endsAt'>,
  ) {
    if (record.startsAt && record.endsAt && record.startsAt > record.endsAt) {
      throw new BadRequestException({
        code: 'CMS_ANNOUNCEMENT_DATE_RANGE_INVALID',
        message: 'Announcement start time must be earlier than end time.',
      });
    }
  }

  private async getNextPageOrderIndex(siteId: string) {
    const page = await this.prisma.cmsPage.findFirst({
      where: { siteId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    return (page?.orderIndex ?? -10) + 10;
  }

  private async getNextBannerOrderIndex(
    siteId: string,
    placement: CmsBannerPlacement,
  ) {
    const banner = await this.prisma.cmsBanner.findFirst({
      where: { siteId, placement },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    return (banner?.orderIndex ?? -10) + 10;
  }

  private async getNextAnnouncementOrderIndex(siteId: string) {
    const announcement = await this.prisma.cmsAnnouncement.findFirst({
      where: { siteId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    return (announcement?.orderIndex ?? -10) + 10;
  }

  private async getNextSectionOrderIndex(
    siteId: string,
    surface: CmsSectionSurface,
  ) {
    const section = await this.prisma.cmsSection.findFirst({
      where: { siteId, surface },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    return (section?.orderIndex ?? -10) + 10;
  }

  private resolvePageSlug(slug: string | undefined, title: string) {
    return cmsSlugify(slug ?? title);
  }

  private async reorderEntities(
    orderedIds: string[],
    updater: (id: string, orderIndex: number) => Promise<unknown>,
  ) {
    for (const [index, id] of orderedIds.entries()) {
      await updater(id, index * 10);
    }
  }

  private notFound(code: string, message: string) {
    return new NotFoundException({
      code,
      message,
    });
  }
}
