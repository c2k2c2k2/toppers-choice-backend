import { Injectable } from '@nestjs/common';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentStatus,
  NoteStatus,
  PlanStatus,
  QuestionStatus,
  TestStatus,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { SEARCH_RUNTIME_CONFIG_KEY } from './search.constants';
import { SearchQueryDto } from './dto/search.dto';

type SearchResultItem = {
  resourceType: string;
  id: string;
  slug: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  visibility: string | null;
};

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  async searchPublic(siteId: string, query: SearchQueryDto) {
    const limit = await this.resolveLimit('public.maxResults', query.limit, 12);
    const now = new Date();
    const [pages, announcements, content, plans] = await Promise.all([
      this.prisma.cmsPage.findMany({
        where: {
          siteId,
          status: 'PUBLISHED',
          visibility: CatalogVisibility.PUBLIC,
          OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
          AND: [
            {
              OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { slug: { contains: query.q, mode: 'insensitive' } },
                { summary: { contains: query.q, mode: 'insensitive' } },
              ],
            },
          ],
        },
        take: limit,
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          status: true,
          visibility: true,
        },
      }),
      this.prisma.cmsAnnouncement.findMany({
        where: {
          siteId,
          status: 'PUBLISHED',
          visibility: CatalogVisibility.PUBLIC,
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { body: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          visibility: true,
        },
      }),
      this.prisma.contentEntry.findMany({
        where: {
          siteId,
          status: ContentStatus.PUBLISHED,
          visibility: CatalogVisibility.PUBLIC,
          accessType: ContentAccessType.FREE,
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { excerpt: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { featuredOrderIndex: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          status: true,
          visibility: true,
        },
      }),
      this.prisma.plan.findMany({
        where: {
          siteId,
          status: PlanStatus.ACTIVE,
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { shortDescription: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          shortDescription: true,
          status: true,
        },
      }),
    ]);

    return this.buildResponse(query.q, [
      {
        resourceType: 'cms_pages',
        items: pages.map((item) => ({
          resourceType: 'cms_page',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.summary,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'cms_announcements',
        items: announcements.map((item) => ({
          resourceType: 'cms_announcement',
          id: item.id,
          slug: null,
          title: item.title,
          subtitle: item.body,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'content_entries',
        items: content.map((item) => ({
          resourceType: 'content_entry',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.excerpt,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'plans',
        items: plans.map((item) => ({
          resourceType: 'plan',
          id: item.id,
          slug: item.slug,
          title: item.name,
          subtitle: item.shortDescription,
          status: item.status,
          visibility: 'PUBLIC',
        })),
      },
    ]);
  }

  async searchStudent(siteId: string, query: SearchQueryDto) {
    const limit = await this.resolveLimit('student.maxResults', query.limit, 16);
    const [pages, announcements, notes, content, tests, plans] = await Promise.all([
      this.prisma.cmsPage.findMany({
        where: {
          siteId,
          status: 'PUBLISHED',
          visibility: {
            in: [CatalogVisibility.PUBLIC, CatalogVisibility.AUTHENTICATED],
          },
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
            { summary: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          status: true,
          visibility: true,
        },
      }),
      this.prisma.cmsAnnouncement.findMany({
        where: {
          siteId,
          status: 'PUBLISHED',
          visibility: {
            in: [CatalogVisibility.PUBLIC, CatalogVisibility.AUTHENTICATED],
          },
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { body: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ isPinned: 'desc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          visibility: true,
        },
      }),
      this.prisma.note.findMany({
        where: {
          siteId,
          status: NoteStatus.PUBLISHED,
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
            { shortDescription: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          status: true,
          accessType: true,
        },
      }),
      this.prisma.contentEntry.findMany({
        where: {
          siteId,
          status: ContentStatus.PUBLISHED,
          visibility: {
            in: [CatalogVisibility.PUBLIC, CatalogVisibility.AUTHENTICATED],
          },
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { excerpt: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { featuredOrderIndex: 'asc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          status: true,
          visibility: true,
        },
      }),
      this.prisma.test.findMany({
        where: {
          siteId,
          status: TestStatus.PUBLISHED,
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
            { shortDescription: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
        select: {
          id: true,
          slug: true,
          title: true,
          shortDescription: true,
          status: true,
          accessType: true,
        },
      }),
      this.prisma.plan.findMany({
        where: {
          siteId,
          status: PlanStatus.ACTIVE,
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { shortDescription: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          slug: true,
          name: true,
          shortDescription: true,
          status: true,
        },
      }),
    ]);

    return this.buildResponse(query.q, [
      {
        resourceType: 'cms_pages',
        items: pages.map((item) => ({
          resourceType: 'cms_page',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.summary,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'cms_announcements',
        items: announcements.map((item) => ({
          resourceType: 'cms_announcement',
          id: item.id,
          slug: null,
          title: item.title,
          subtitle: item.body,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'notes',
        items: notes.map((item) => ({
          resourceType: 'note',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.shortDescription,
          status: item.status,
          visibility: item.accessType,
        })),
      },
      {
        resourceType: 'content_entries',
        items: content.map((item) => ({
          resourceType: 'content_entry',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.excerpt,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'tests',
        items: tests.map((item) => ({
          resourceType: 'test',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.shortDescription,
          status: item.status,
          visibility: item.accessType,
        })),
      },
      {
        resourceType: 'plans',
        items: plans.map((item) => ({
          resourceType: 'plan',
          id: item.id,
          slug: item.slug,
          title: item.name,
          subtitle: item.shortDescription,
          status: item.status,
          visibility: 'PUBLIC',
        })),
      },
    ]);
  }

  async searchAdmin(siteId: string, query: SearchQueryDto) {
    const limit = await this.resolveLimit('admin.maxResults', query.limit, 20);
    const [users, pages, notes, content, questions, tests, plans, broadcasts] =
      await Promise.all([
        this.prisma.user.findMany({
          where: {
            siteId,
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { fullName: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            email: true,
            fullName: true,
            userType: true,
            status: true,
          },
        }),
        this.prisma.cmsPage.findMany({
          where: {
            siteId,
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            status: true,
            visibility: true,
          },
        }),
        this.prisma.note.findMany({
          where: {
            siteId,
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { shortDescription: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            shortDescription: true,
            status: true,
            accessType: true,
          },
        }),
        this.prisma.contentEntry.findMany({
          where: {
            siteId,
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { excerpt: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            status: true,
            visibility: true,
          },
        }),
        this.prisma.question.findMany({
          where: {
            siteId,
            OR: [
              { code: { contains: query.q, mode: 'insensitive' } },
              { searchText: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            code: true,
            searchText: true,
            status: true,
          },
        }),
        this.prisma.test.findMany({
          where: {
            siteId,
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
              { shortDescription: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            slug: true,
            title: true,
            shortDescription: true,
            status: true,
            accessType: true,
          },
        }),
        this.prisma.plan.findMany({
          where: {
            siteId,
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { shortDescription: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            slug: true,
            name: true,
            shortDescription: true,
            status: true,
          },
        }),
        this.prisma.notificationBroadcast.findMany({
          where: {
            siteId,
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { body: { contains: query.q, mode: 'insensitive' } },
            ],
          },
          take: limit,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            title: true,
            body: true,
            status: true,
          },
        }),
      ]);

    return this.buildResponse(query.q, [
      {
        resourceType: 'users',
        items: users.map((item) => ({
          resourceType: 'user',
          id: item.id,
          slug: null,
          title: item.fullName,
          subtitle: item.email,
          status: item.status,
          visibility: item.userType,
        })),
      },
      {
        resourceType: 'cms_pages',
        items: pages.map((item) => ({
          resourceType: 'cms_page',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.summary,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'notes',
        items: notes.map((item) => ({
          resourceType: 'note',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.shortDescription,
          status: item.status,
          visibility: item.accessType,
        })),
      },
      {
        resourceType: 'content_entries',
        items: content.map((item) => ({
          resourceType: 'content_entry',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.excerpt,
          status: item.status,
          visibility: item.visibility,
        })),
      },
      {
        resourceType: 'questions',
        items: questions.map((item) => ({
          resourceType: 'question',
          id: item.id,
          slug: item.code ?? null,
          title: item.code ?? 'Question',
          subtitle: item.searchText,
          status: item.status,
          visibility: null,
        })),
      },
      {
        resourceType: 'tests',
        items: tests.map((item) => ({
          resourceType: 'test',
          id: item.id,
          slug: item.slug,
          title: item.title,
          subtitle: item.shortDescription,
          status: item.status,
          visibility: item.accessType,
        })),
      },
      {
        resourceType: 'plans',
        items: plans.map((item) => ({
          resourceType: 'plan',
          id: item.id,
          slug: item.slug,
          title: item.name,
          subtitle: item.shortDescription,
          status: item.status,
          visibility: 'PUBLIC',
        })),
      },
      {
        resourceType: 'notification_broadcasts',
        items: broadcasts.map((item) => ({
          resourceType: 'notification_broadcast',
          id: item.id,
          slug: null,
          title: item.title,
          subtitle: item.body,
          status: item.status,
          visibility: null,
        })),
      },
    ]);
  }

  private async resolveLimit(
    path: string,
    requestedLimit: number | undefined,
    fallback: number,
  ) {
    const maxResults = await this.siteSettingsService.getNumberSetting(
      SEARCH_RUNTIME_CONFIG_KEY,
      path,
      {
        fallback,
        min: 1,
        max: 50,
        integer: true,
      },
    );

    return requestedLimit ? Math.min(requestedLimit, maxResults) : maxResults;
  }

  private buildResponse(
    query: string,
    groups: Array<{
      resourceType: string;
      items: SearchResultItem[];
    }>,
  ) {
    const filteredGroups = groups.filter((group) => group.items.length > 0);
    const total = filteredGroups.reduce(
      (sum, group) => sum + group.items.length,
      0,
    );

    return {
      query,
      total,
      groups: filteredGroups,
    };
  }
}
