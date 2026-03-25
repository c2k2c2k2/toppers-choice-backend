import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  mapPlan,
  planDetailSelect,
  type PlanDetailRecord,
} from './payments.types';
import type {
  CreatePlanDto,
  ListPlansQueryDto,
  UpdatePlanDto,
} from './dto/manage-payments.dto';

type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  async listPublicPlans(query: ListPlansQueryDto) {
    const siteId = await this.resolvePublicSiteId();
    const where = this.buildPlanWhere(siteId, query, true);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: planDetailSelect,
      }),
      this.prisma.plan.count({ where }),
    ]);

    return {
      items: items.map((item) => mapPlan(item)),
      total,
    };
  }

  async getPublicPlan(planId: string) {
    const siteId = await this.resolvePublicSiteId();
    const plan = await this.prisma.plan.findFirst({
      where: {
        siteId,
        id: planId,
        status: PlanStatus.ACTIVE,
      },
      select: planDetailSelect,
    });

    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan was not found.',
      });
    }

    return mapPlan(plan);
  }

  async listAdminPlans(siteId: string, query: ListPlansQueryDto) {
    const where = this.buildPlanWhere(siteId, query, false);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: planDetailSelect,
      }),
      this.prisma.plan.count({ where }),
    ]);

    return {
      items: items.map((item) => mapPlan(item)),
      total,
    };
  }

  async getAdminPlan(siteId: string, planId: string) {
    const plan = await this.getPlanRecord(siteId, planId);
    return mapPlan(plan);
  }

  async getPlanRecordForSite(siteId: string, planId: string) {
    return this.getPlanRecord(siteId, planId);
  }

  async createPlan(user: AuthenticatedUser, input: CreatePlanDto) {
    try {
      const createdPlanId = await this.prisma.$transaction(async (tx) => {
        const plan = await tx.plan.create({
          data: {
            siteId: user.siteId,
            code: input.code.trim().toLowerCase(),
            slug: this.buildPlanSlug(input.slug, input.name),
            name: input.name.trim(),
            shortDescription: input.shortDescription?.trim() ?? null,
            description: input.description?.trim() ?? null,
            pricePaise: input.pricePaise,
            currencyCode: (input.currencyCode ?? 'INR').trim().toUpperCase(),
            durationDays: input.durationDays,
            sortOrder: input.sortOrder ?? 0,
            status: input.status ?? PlanStatus.INACTIVE,
            metadataJson:
              input.metadataJson === undefined
                ? Prisma.DbNull
                : (input.metadataJson as Prisma.InputJsonValue),
            createdByUserId: user.userId,
            updatedByUserId: user.userId,
          },
          select: {
            id: true,
          },
        });

        await this.syncPlanEntitlements(tx, user.siteId, plan.id, input);

        return plan.id;
      });

      return this.getAdminPlan(user.siteId, createdPlanId);
    } catch (error) {
      this.rethrowKnownPlanConflict(error);
    }
  }

  async updatePlan(user: AuthenticatedUser, planId: string, input: UpdatePlanDto) {
    const existing = await this.getPlanRecord(user.siteId, planId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.plan.update({
          where: {
            id: existing.id,
          },
          data: {
            code:
              input.code === undefined
                ? undefined
                : input.code.trim().toLowerCase(),
            slug:
              input.slug === undefined
                ? undefined
                : this.buildPlanSlug(input.slug, input.name ?? existing.name),
            name: input.name?.trim(),
            shortDescription:
              input.shortDescription === undefined
                ? undefined
                : input.shortDescription?.trim() ?? null,
            description:
              input.description === undefined
                ? undefined
                : input.description?.trim() ?? null,
            pricePaise: input.pricePaise,
            currencyCode:
              input.currencyCode === undefined
                ? undefined
                : input.currencyCode.trim().toUpperCase(),
            durationDays: input.durationDays,
            sortOrder: input.sortOrder,
            status: input.status,
            metadataJson:
              input.metadataJson === undefined
                ? undefined
                : input.metadataJson === null
                  ? Prisma.DbNull
                  : (input.metadataJson as Prisma.InputJsonValue),
            updatedByUserId: user.userId,
          },
        });

        if (input.entitlements) {
          await this.syncPlanEntitlements(tx, user.siteId, existing.id, input);
        }
      });

      return this.getAdminPlan(user.siteId, existing.id);
    } catch (error) {
      this.rethrowKnownPlanConflict(error);
    }
  }

  async getActivePlanByCheckoutInput(
    siteId: string,
    input: {
      planId?: string;
      planCode?: string;
    },
  ) {
    if (!input.planId && !input.planCode) {
      throw new BadRequestException({
        code: 'PLAN_REFERENCE_REQUIRED',
        message: 'planId or planCode is required.',
      });
    }

    const plan = await this.prisma.plan.findFirst({
      where: {
        siteId,
        status: PlanStatus.ACTIVE,
        ...(input.planId
          ? {
              id: input.planId,
            }
          : {
              code: input.planCode?.trim().toLowerCase(),
            }),
      },
      select: planDetailSelect,
    });

    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Active plan was not found.',
      });
    }

    return plan;
  }

  private async getPlanRecord(siteId: string, planId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: {
        siteId,
        id: planId,
      },
      select: planDetailSelect,
    });

    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Plan was not found.',
      });
    }

    return plan;
  }

  private buildPlanWhere(
    siteId: string,
    query: ListPlansQueryDto,
    publicOnly: boolean,
  ): Prisma.PlanWhereInput {
    return {
      siteId,
      status: publicOnly ? PlanStatus.ACTIVE : query.status,
      ...(query.search
        ? {
            OR: [
              {
                code: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
  }

  private async syncPlanEntitlements(
    tx: PrismaTransactionClient,
    siteId: string,
    planId: string,
    input: Pick<CreatePlanDto, 'entitlements'> | Pick<UpdatePlanDto, 'entitlements'>,
  ) {
    await tx.planEntitlement.deleteMany({
      where: {
        planId,
      },
    });

    if (!input.entitlements || input.entitlements.length === 0) {
      return;
    }

    await tx.planEntitlement.createMany({
      data: input.entitlements.map((entitlement, index) => ({
        siteId,
        planId,
        entitlementKind: entitlement.entitlementKind,
        scopeJson:
          entitlement.scopeJson === undefined
            ? Prisma.DbNull
            : (entitlement.scopeJson as Prisma.InputJsonValue),
        orderIndex: entitlement.orderIndex ?? index,
      })),
    });
  }

  private buildPlanSlug(inputSlug: string | undefined, name: string) {
    const source = inputSlug?.trim() || name;
    return source
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  private async resolvePublicSiteId() {
    const bootstrap = await this.siteSettingsService.getPublicBootstrap();
    return bootstrap.site.id;
  }

  private rethrowKnownPlanConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'PLAN_CONFLICT',
        message: 'Plan code or slug must be unique within the site.',
      });
    }

    throw error;
  }
}
