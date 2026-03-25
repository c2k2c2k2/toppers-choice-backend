import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentFormat,
  ContentStatus,
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  UserType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  FeatureContentEntryDto,
  type ContentAttachmentInputDto,
  type CreateContentEntryDto,
  type ListAdminContentQueryDto,
  type ListPublishedContentQueryDto,
  type PublicListContentQueryDto,
  type PublishContentEntryDto,
  type ReorderContentEntriesDto,
  type ResolvePublicContentQueryDto,
  type UpdateContentEntryDto,
} from './dto/manage-content.dto';
import {
  canAuthenticatedUsersReadFreeContent,
  canPubliclyDeliverFreeContent,
  contentEntrySelect,
  getAdminContentAccessSummary,
  getPublicContentAccessSummary,
  mapContentEntry,
  type ContentAccessSummary,
  type ContentEntryRecord,
} from './content.types';
import { ContentEntitlementService } from './content.entitlement.service';
import { slugifyContentValue } from './content.utils';

type NormalizedAttachmentInput = {
  fileAssetId: string;
  label: string | null;
  orderIndex: number;
};

type AssetAccessRecord = {
  id: string;
  purpose: FileAssetPurpose;
  accessLevel: FileAssetAccess;
  status: FileAssetStatus;
  contentType: string;
};

@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly contentEntitlementService: ContentEntitlementService,
  ) {}

  async listAdminContent(siteId: string, query: ListAdminContentQueryDto) {
    const where = this.buildAdminContentWhere(siteId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentEntry.findMany({
        where,
        orderBy: [
          { isFeatured: 'desc' },
          { featuredOrderIndex: 'asc' },
          { orderIndex: 'asc' },
          { title: 'asc' },
        ],
        select: contentEntrySelect,
      }),
      this.prisma.contentEntry.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        mapContentEntry(item, getAdminContentAccessSummary()),
      ),
      total,
    };
  }

  async getAdminContent(siteId: string, contentEntryId: string) {
    const entry = await this.prisma.contentEntry.findFirst({
      where: {
        id: contentEntryId,
        siteId,
      },
      select: contentEntrySelect,
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Structured content entry was not found.',
      });
    }

    return mapContentEntry(entry, getAdminContentAccessSummary(), {
      includeBody: true,
      includeAttachments: true,
    });
  }

  async createContent(user: AuthenticatedUser, input: CreateContentEntryDto) {
    const visibility = input.visibility ?? CatalogVisibility.PUBLIC;
    const accessType = input.accessType ?? ContentAccessType.FREE;
    const format = input.format ?? ContentFormat.ARTICLE;
    const slug = this.resolveSlug(input.slug, input.title);
    const orderIndex =
      input.orderIndex ?? (await this.getNextOrderIndex(user.siteId));
    const examTrackIds = await this.validateExamTrackIds(
      user.siteId,
      input.examTrackIds ?? [],
    );
    const mediumIds = await this.validateMediumIds(
      user.siteId,
      input.mediumIds ?? [],
    );
    const coverAsset = await this.validateCoverImageAsset(
      user.siteId,
      input.coverImageAssetId,
    );
    const attachments = await this.validateAttachmentInputs(
      user.siteId,
      input.attachments ?? [],
    );

    this.assertAssetAccessCompatibility(
      visibility,
      accessType,
      coverAsset ? [coverAsset] : [],
      attachments.assets,
    );

    const contentEntryId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contentEntry.create({
        data: {
          siteId: user.siteId,
          family: input.family,
          format,
          visibility,
          accessType,
          slug,
          title: input.title.trim(),
          excerpt: input.excerpt?.trim() || null,
          bodyJson: input.bodyJson as Prisma.InputJsonValue,
          metaJson:
            input.metaJson === undefined
              ? Prisma.DbNull
              : (input.metaJson as Prisma.InputJsonValue),
          coverImageAssetId: input.coverImageAssetId ?? null,
          orderIndex,
          readingTimeMinutes: input.readingTimeMinutes ?? null,
          createdByUserId: user.userId,
          updatedByUserId: user.userId,
        },
        select: {
          id: true,
          siteId: true,
          coverImageAssetId: true,
          visibility: true,
          accessType: true,
        },
      });

      await this.syncExamTrackLinks(tx, created.id, examTrackIds);
      await this.syncMediumLinks(tx, created.id, mediumIds);
      await this.syncAttachments(tx, created.id, attachments.items);
      await this.syncFileAssetReferences(tx, {
        siteId: created.siteId,
        contentEntryId: created.id,
        visibility: created.visibility,
        accessType: created.accessType,
        coverImageAssetId: created.coverImageAssetId,
        attachmentAssetIds: attachments.items.map((item) => item.fileAssetId),
      });

      return created.id;
    });

    return this.getAdminContent(user.siteId, contentEntryId);
  }

  async updateContent(
    user: AuthenticatedUser,
    contentEntryId: string,
    input: UpdateContentEntryDto,
  ) {
    const existing = await this.prisma.contentEntry.findFirst({
      where: {
        id: contentEntryId,
        siteId: user.siteId,
      },
      select: contentEntrySelect,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Structured content entry was not found.',
      });
    }

    const nextVisibility = input.visibility ?? existing.visibility;
    const nextAccessType = input.accessType ?? existing.accessType;
    const nextFormat = input.format ?? existing.format;
    const nextTitle = input.title ?? existing.title;
    const nextSlug =
      input.slug === undefined && input.title === undefined
        ? undefined
        : this.resolveSlug(input.slug ?? existing.slug, nextTitle);
    const nextCoverImageAssetId =
      input.coverImageAssetId === undefined
        ? existing.coverImageAssetId
        : (input.coverImageAssetId ?? null);
    const nextExamTrackIds =
      input.examTrackIds === undefined
        ? existing.examTrackLinks.map(({ examTrack }) => examTrack.id)
        : await this.validateExamTrackIds(user.siteId, input.examTrackIds);
    const nextMediumIds =
      input.mediumIds === undefined
        ? existing.mediumLinks.map(({ medium }) => medium.id)
        : await this.validateMediumIds(user.siteId, input.mediumIds);
    const nextAttachments =
      input.attachments === undefined
        ? existing.attachments.map((attachment) => ({
            fileAssetId: attachment.fileAssetId,
            label: attachment.label,
            orderIndex: attachment.orderIndex,
          }))
        : (await this.validateAttachmentInputs(user.siteId, input.attachments))
            .items;

    const coverAsset = await this.validateCoverImageAsset(
      user.siteId,
      nextCoverImageAssetId,
    );
    const attachmentAssets = await this.validateAttachmentInputs(
      user.siteId,
      nextAttachments,
    );

    this.assertAssetAccessCompatibility(
      nextVisibility,
      nextAccessType,
      coverAsset ? [coverAsset] : [],
      attachmentAssets.assets,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.contentEntry.update({
        where: { id: contentEntryId },
        data: {
          family: input.family,
          format: nextFormat,
          visibility: nextVisibility,
          accessType: nextAccessType,
          slug: nextSlug,
          title: input.title?.trim(),
          excerpt:
            input.excerpt === undefined
              ? undefined
              : input.excerpt?.trim() || null,
          bodyJson:
            input.bodyJson === undefined
              ? undefined
              : (input.bodyJson as Prisma.InputJsonValue),
          metaJson:
            input.metaJson === undefined
              ? undefined
              : input.metaJson === null
                ? Prisma.DbNull
                : (input.metaJson as Prisma.InputJsonValue),
          coverImageAssetId:
            input.coverImageAssetId === undefined
              ? undefined
              : nextCoverImageAssetId,
          orderIndex: input.orderIndex,
          readingTimeMinutes:
            input.readingTimeMinutes === undefined
              ? undefined
              : (input.readingTimeMinutes ?? null),
          updatedByUserId: user.userId,
        },
      });

      await this.syncExamTrackLinks(tx, contentEntryId, nextExamTrackIds);
      await this.syncMediumLinks(tx, contentEntryId, nextMediumIds);
      await this.syncAttachments(tx, contentEntryId, nextAttachments);
      await this.syncFileAssetReferences(tx, {
        siteId: user.siteId,
        contentEntryId,
        visibility: nextVisibility,
        accessType: nextAccessType,
        coverImageAssetId: nextCoverImageAssetId,
        attachmentAssetIds: nextAttachments.map((item) => item.fileAssetId),
      });
    });

    return this.getAdminContent(user.siteId, contentEntryId);
  }

  async publishContent(
    user: AuthenticatedUser,
    contentEntryId: string,
    input: PublishContentEntryDto,
  ) {
    const existing = await this.prisma.contentEntry.findFirst({
      where: {
        id: contentEntryId,
        siteId: user.siteId,
      },
      select: contentEntrySelect,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Structured content entry was not found.',
      });
    }

    this.assertAssetAccessCompatibility(
      existing.visibility,
      existing.accessType,
      existing.coverImageAsset ? [existing.coverImageAsset] : [],
      existing.attachments.map((attachment) => attachment.fileAsset),
    );

    const publishAt = input.publishAt ? new Date(input.publishAt) : new Date();

    await this.prisma.contentEntry.update({
      where: { id: contentEntryId },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: publishAt,
        archivedAt: null,
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminContent(user.siteId, contentEntryId);
  }

  async unpublishContent(user: AuthenticatedUser, contentEntryId: string) {
    const existing = await this.prisma.contentEntry.findFirst({
      where: {
        id: contentEntryId,
        siteId: user.siteId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Structured content entry was not found.',
      });
    }

    await this.prisma.contentEntry.update({
      where: { id: contentEntryId },
      data: {
        status: ContentStatus.DRAFT,
        publishedAt: null,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminContent(user.siteId, contentEntryId);
  }

  async featureContent(
    user: AuthenticatedUser,
    contentEntryId: string,
    input: FeatureContentEntryDto,
  ) {
    const existing = await this.prisma.contentEntry.findFirst({
      where: {
        id: contentEntryId,
        siteId: user.siteId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Structured content entry was not found.',
      });
    }

    await this.prisma.contentEntry.update({
      where: { id: contentEntryId },
      data: {
        isFeatured: true,
        featuredOrderIndex:
          input.featuredOrderIndex ??
          (await this.getNextFeaturedOrderIndex(user.siteId)),
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminContent(user.siteId, contentEntryId);
  }

  async unfeatureContent(user: AuthenticatedUser, contentEntryId: string) {
    const existing = await this.prisma.contentEntry.findFirst({
      where: {
        id: contentEntryId,
        siteId: user.siteId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Structured content entry was not found.',
      });
    }

    await this.prisma.contentEntry.update({
      where: { id: contentEntryId },
      data: {
        isFeatured: false,
        featuredOrderIndex: null,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminContent(user.siteId, contentEntryId);
  }

  async reorderContent(siteId: string, input: ReorderContentEntriesDto) {
    const uniqueOrderedIds = Array.from(new Set(input.orderedIds));
    const entries = await this.prisma.contentEntry.findMany({
      where: {
        id: {
          in: uniqueOrderedIds,
        },
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (entries.length !== uniqueOrderedIds.length) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT_REORDER_IDS',
        message: 'One or more content entry ids are invalid for this site.',
      });
    }

    await this.prisma.$transaction(
      uniqueOrderedIds.map((contentEntryId, index) =>
        this.prisma.contentEntry.update({
          where: { id: contentEntryId },
          data: {
            orderIndex: (index + 1) * 10,
          },
        }),
      ),
    );
  }

  async listPublicContent(query: PublicListContentQueryDto) {
    const siteId = await this.resolvePublicSiteId(query.siteCode);
    const where = this.buildPublishedContentWhere(
      siteId,
      query,
      [CatalogVisibility.PUBLIC],
      true,
    );
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentEntry.findMany({
        where,
        orderBy: this.publishedContentOrderBy(),
        select: contentEntrySelect,
      }),
      this.prisma.contentEntry.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        mapContentEntry(item, getPublicContentAccessSummary()),
      ),
      total,
    };
  }

  async getPublicContentBySlug(
    slug: string,
    resolveQuery: ResolvePublicContentQueryDto,
  ) {
    const siteId = await this.resolvePublicSiteId(resolveQuery.siteCode);
    const entry = await this.prisma.contentEntry.findFirst({
      where: {
        siteId,
        slug,
        visibility: CatalogVisibility.PUBLIC,
        accessType: ContentAccessType.FREE,
        status: ContentStatus.PUBLISHED,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
      select: contentEntrySelect,
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Public content entry was not found.',
      });
    }

    return mapContentEntry(entry, getPublicContentAccessSummary(), {
      includeBody: true,
      includeAttachments: true,
    });
  }

  async listPublishedContent(
    user: AuthenticatedUser,
    query: ListPublishedContentQueryDto,
  ) {
    const where = this.buildPublishedContentWhere(
      user.siteId,
      query,
      [CatalogVisibility.PUBLIC, CatalogVisibility.AUTHENTICATED],
      false,
    );
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contentEntry.findMany({
        where,
        orderBy: this.publishedContentOrderBy(),
        select: contentEntrySelect,
      }),
      this.prisma.contentEntry.count({ where }),
    ]);

    return {
      items: await Promise.all(
        items.map(async (item) =>
          mapContentEntry(item, await this.resolveAccessForUser(user, item)),
        ),
      ),
      total,
    };
  }

  async getPublishedContentBySlug(user: AuthenticatedUser, slug: string) {
    const entry = await this.prisma.contentEntry.findFirst({
      where: {
        siteId: user.siteId,
        slug,
        visibility: {
          in: [CatalogVisibility.PUBLIC, CatalogVisibility.AUTHENTICATED],
        },
        status: ContentStatus.PUBLISHED,
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
      select: contentEntrySelect,
    });

    if (!entry) {
      throw new NotFoundException({
        code: 'CONTENT_ENTRY_NOT_FOUND',
        message: 'Published content entry was not found.',
      });
    }

    const access = await this.resolveAccessForUser(user, entry);

    return mapContentEntry(entry, access, {
      includeBody: access.canView,
      includeAttachments: access.canView,
    });
  }

  private buildAdminContentWhere(
    siteId: string,
    query: ListAdminContentQueryDto,
  ): Prisma.ContentEntryWhereInput {
    const and: Prisma.ContentEntryWhereInput[] = [];

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
          { excerpt: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      siteId,
      family: query.family,
      status: query.status,
      visibility: query.visibility,
      accessType: query.accessType,
      isFeatured: query.isFeatured,
      examTrackLinks: query.examTrackId
        ? {
            some: {
              examTrackId: query.examTrackId,
            },
          }
        : undefined,
      mediumLinks: query.mediumId
        ? {
            some: {
              mediumId: query.mediumId,
            },
          }
        : undefined,
      AND: and.length > 0 ? and : undefined,
    };
  }

  private buildPublishedContentWhere(
    siteId: string,
    query: ListPublishedContentQueryDto,
    visibilities: CatalogVisibility[],
    freeOnly: boolean,
  ): Prisma.ContentEntryWhereInput {
    const and: Prisma.ContentEntryWhereInput[] = [
      {
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
    ];

    if (query.search) {
      and.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
          { excerpt: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      siteId,
      family: query.family,
      format: query.format,
      visibility: {
        in: visibilities,
      },
      accessType: freeOnly ? ContentAccessType.FREE : undefined,
      status: ContentStatus.PUBLISHED,
      isFeatured: query.featuredOnly ? true : undefined,
      examTrackLinks: query.examTrackId
        ? {
            some: {
              examTrackId: query.examTrackId,
            },
          }
        : undefined,
      mediumLinks: query.mediumId
        ? {
            some: {
              mediumId: query.mediumId,
            },
          }
        : undefined,
      AND: and,
    };
  }

  private publishedContentOrderBy(): Prisma.ContentEntryOrderByWithRelationInput[] {
    return [
      { isFeatured: 'desc' },
      { featuredOrderIndex: 'asc' },
      { orderIndex: 'asc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ];
  }

  private async resolveAccessForUser(
    user: AuthenticatedUser,
    entry: ContentEntryRecord,
  ): Promise<ContentAccessSummary> {
    if (user.userType === UserType.ADMIN) {
      return getAdminContentAccessSummary();
    }

    if (
      canAuthenticatedUsersReadFreeContent(entry.visibility, entry.accessType)
    ) {
      return {
        mode: 'FULL',
        canView: true,
        requiresEntitlement: false,
        reason: null,
      };
    }

    if (entry.accessType === ContentAccessType.PREMIUM) {
      const hasPremiumAccess =
        await this.contentEntitlementService.canAccessPremiumContent(
          user.userId,
          entry.id,
        );

      if (hasPremiumAccess) {
        return {
          mode: 'FULL',
          canView: true,
          requiresEntitlement: true,
          reason: null,
        };
      }

      return {
        mode: 'LOCKED',
        canView: false,
        requiresEntitlement: true,
        reason: 'Active premium entitlement is required for this content.',
      };
    }

    if (entry.visibility === CatalogVisibility.INTERNAL) {
      return {
        mode: 'LOCKED',
        canView: false,
        requiresEntitlement: false,
        reason: 'This content is internal and not available to students.',
      };
    }

    return {
      mode: 'LOCKED',
      canView: false,
      requiresEntitlement: false,
      reason: 'This content is not available for the current user.',
    };
  }

  private async resolvePublicSiteId(siteCode?: string) {
    const bootstrap =
      await this.siteSettingsService.getPublicBootstrap(siteCode);
    return bootstrap.site.id;
  }

  private async validateExamTrackIds(siteId: string, examTrackIds: string[]) {
    const uniqueIds: string[] = Array.from(new Set(examTrackIds));
    if (uniqueIds.length === 0) {
      return uniqueIds;
    }

    const items = await this.prisma.examTrack.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (items.length !== uniqueIds.length) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT_EXAM_TRACK_IDS',
        message: 'One or more exam track ids are invalid for this site.',
      });
    }

    return uniqueIds;
  }

  private async validateMediumIds(siteId: string, mediumIds: string[]) {
    const uniqueIds: string[] = Array.from(new Set(mediumIds));
    if (uniqueIds.length === 0) {
      return uniqueIds;
    }

    const items = await this.prisma.medium.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (items.length !== uniqueIds.length) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT_MEDIUM_IDS',
        message: 'One or more medium ids are invalid for this site.',
      });
    }

    return uniqueIds;
  }

  private async validateCoverImageAsset(
    siteId: string,
    assetId?: string | null,
  ) {
    if (!assetId) {
      return null;
    }

    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId,
        status: FileAssetStatus.READY,
      },
      select: {
        id: true,
        purpose: true,
        accessLevel: true,
        status: true,
        contentType: true,
      },
    });

    if (!asset || !asset.contentType.startsWith('image/')) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT_COVER_ASSET',
        message: 'A ready image file asset is required for content covers.',
      });
    }

    return asset;
  }

  private async validateAttachmentInputs(
    siteId: string,
    attachments: Array<ContentAttachmentInputDto | NormalizedAttachmentInput>,
  ): Promise<{
    items: NormalizedAttachmentInput[];
    assets: AssetAccessRecord[];
  }> {
    const items = attachments.map((attachment, index) => ({
      fileAssetId: attachment.fileAssetId,
      label: attachment.label?.trim() || null,
      orderIndex: attachment.orderIndex ?? (index + 1) * 10,
    }));
    const uniqueIds: string[] = Array.from(
      new Set(items.map((item) => item.fileAssetId)),
    );

    if (uniqueIds.length === 0) {
      return {
        items,
        assets: [],
      };
    }

    const assets = await this.prisma.fileAsset.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
        siteId,
        status: FileAssetStatus.READY,
      },
      select: {
        id: true,
        purpose: true,
        accessLevel: true,
        status: true,
        contentType: true,
      },
    });

    if (assets.length !== uniqueIds.length) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT_ATTACHMENT_ASSET_IDS',
        message:
          'One or more attachment file assets are invalid for this site.',
      });
    }

    for (const asset of assets) {
      if (
        asset.purpose === FileAssetPurpose.PROFILE_IMAGE ||
        asset.purpose === FileAssetPurpose.NOTE_PDF
      ) {
        throw new BadRequestException({
          code: 'INVALID_CONTENT_ATTACHMENT_ASSET',
          message:
            'Profile images and note PDF assets cannot be attached to structured content.',
        });
      }
    }

    return {
      items,
      assets,
    };
  }

  private assertAssetAccessCompatibility(
    visibility: CatalogVisibility,
    accessType: ContentAccessType,
    coverAssets: AssetAccessRecord[],
    attachmentAssets: AssetAccessRecord[],
  ) {
    const assets = [...coverAssets, ...attachmentAssets];
    if (assets.length === 0) {
      return;
    }

    if (canPubliclyDeliverFreeContent(visibility, accessType)) {
      const nonPublicAssets = assets.filter(
        (asset) => asset.accessLevel !== FileAssetAccess.PUBLIC,
      );

      if (nonPublicAssets.length > 0) {
        throw new BadRequestException({
          code: 'CONTENT_PUBLIC_ASSET_ACCESS_INVALID',
          message:
            'Public free content requires cover and attachment assets to be uploaded with PUBLIC access.',
        });
      }

      return;
    }

    if (canAuthenticatedUsersReadFreeContent(visibility, accessType)) {
      const invalidAssets = assets.filter(
        (asset) =>
          asset.accessLevel !== FileAssetAccess.PUBLIC &&
          asset.accessLevel !== FileAssetAccess.AUTHENTICATED,
      );

      if (invalidAssets.length > 0) {
        throw new BadRequestException({
          code: 'CONTENT_AUTH_ASSET_ACCESS_INVALID',
          message:
            'Free authenticated content requires cover and attachment assets to use PUBLIC or AUTHENTICATED access.',
        });
      }
    }
  }

  private async getNextOrderIndex(siteId: string) {
    const aggregate = await this.prisma.contentEntry.aggregate({
      where: { siteId },
      _max: { orderIndex: true },
    });

    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private async getNextFeaturedOrderIndex(siteId: string) {
    const aggregate = await this.prisma.contentEntry.aggregate({
      where: {
        siteId,
        isFeatured: true,
      },
      _max: { featuredOrderIndex: true },
    });

    return (aggregate._max.featuredOrderIndex ?? 0) + 10;
  }

  private resolveSlug(slug: string | undefined, title: string) {
    const normalized = slugifyContentValue(slug ?? title);
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT_SLUG',
        message: 'Content slug could not be resolved from the provided value.',
      });
    }

    return normalized;
  }

  private async syncExamTrackLinks(
    tx: Prisma.TransactionClient,
    contentEntryId: string,
    examTrackIds: string[],
  ) {
    await tx.contentEntryExamTrack.deleteMany({
      where: {
        contentEntryId,
      },
    });

    if (examTrackIds.length === 0) {
      return;
    }

    await tx.contentEntryExamTrack.createMany({
      data: examTrackIds.map((examTrackId) => ({
        contentEntryId,
        examTrackId,
      })),
      skipDuplicates: true,
    });
  }

  private async syncMediumLinks(
    tx: Prisma.TransactionClient,
    contentEntryId: string,
    mediumIds: string[],
  ) {
    await tx.contentEntryMedium.deleteMany({
      where: {
        contentEntryId,
      },
    });

    if (mediumIds.length === 0) {
      return;
    }

    await tx.contentEntryMedium.createMany({
      data: mediumIds.map((mediumId) => ({
        contentEntryId,
        mediumId,
      })),
      skipDuplicates: true,
    });
  }

  private async syncAttachments(
    tx: Prisma.TransactionClient,
    contentEntryId: string,
    attachments: NormalizedAttachmentInput[],
  ) {
    await tx.contentAttachment.deleteMany({
      where: {
        contentEntryId,
      },
    });

    if (attachments.length === 0) {
      return;
    }

    await tx.contentAttachment.createMany({
      data: attachments.map((attachment) => ({
        contentEntryId,
        fileAssetId: attachment.fileAssetId,
        label: attachment.label,
        orderIndex: attachment.orderIndex,
      })),
      skipDuplicates: true,
    });
  }

  private async syncFileAssetReferences(
    tx: Prisma.TransactionClient,
    input: {
      siteId: string;
      contentEntryId: string;
      visibility: CatalogVisibility;
      accessType: ContentAccessType;
      coverImageAssetId: string | null;
      attachmentAssetIds: string[];
    },
  ) {
    await tx.fileAssetReference.deleteMany({
      where: {
        siteId: input.siteId,
        resourceType: 'content_entry',
        resourceId: input.contentEntryId,
      },
    });

    const accessLevel = this.resolveReferenceAccessLevel(
      input.visibility,
      input.accessType,
    );
    const references: Array<{
      fileAssetId: string;
      slot: string;
    }> = [];

    if (input.coverImageAssetId) {
      references.push({
        fileAssetId: input.coverImageAssetId,
        slot: 'cover_image',
      });
    }

    for (const attachmentAssetId of input.attachmentAssetIds) {
      references.push({
        fileAssetId: attachmentAssetId,
        slot: 'attachment',
      });
    }

    if (references.length === 0) {
      return;
    }

    await tx.fileAssetReference.createMany({
      data: references.map((reference, index) => ({
        siteId: input.siteId,
        fileAssetId: reference.fileAssetId,
        resourceType: 'content_entry',
        resourceId: input.contentEntryId,
        slot:
          reference.slot === 'attachment'
            ? `attachment:${index}`
            : reference.slot,
        accessLevel,
      })),
      skipDuplicates: true,
    });
  }

  private resolveReferenceAccessLevel(
    visibility: CatalogVisibility,
    accessType: ContentAccessType,
  ) {
    if (
      visibility === CatalogVisibility.PUBLIC &&
      accessType === ContentAccessType.FREE
    ) {
      return FileAssetAccess.PUBLIC;
    }

    if (
      visibility === CatalogVisibility.AUTHENTICATED &&
      accessType === ContentAccessType.FREE
    ) {
      return FileAssetAccess.AUTHENTICATED;
    }

    return FileAssetAccess.PROTECTED;
  }
}
