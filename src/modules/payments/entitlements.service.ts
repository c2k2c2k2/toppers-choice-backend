import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntitlementKind,
  EntitlementSourceType,
  Prisma,
  SubscriptionStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PlansService } from './plans.service';
import { PaymentSettingsService } from './payment-settings.service';
import { TrialAccessService } from './trial-access.service';
import {
  isActiveEntitlement,
  mapEntitlement,
  type EntitlementCriteria,
  type EntitlementRecord,
  entitlementSelect,
} from './payments.types';
import type {
  GrantEntitlementDto,
  RevokeEntitlementDto,
} from './dto/manage-payments.dto';

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly paymentSettingsService: PaymentSettingsService,
    private readonly trialAccessService: TrialAccessService,
  ) {}

  async listCurrentUserEntitlements(user: AuthenticatedUser) {
    await this.syncSubscriptionStates(user.siteId, user.userId);
    const now = new Date();
    const items = await this.prisma.entitlement.findMany({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        revokedAt: null,
        OR: [
          {
            endsAt: null,
          },
          {
            endsAt: {
              gt: now,
            },
          },
        ],
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
      select: entitlementSelect,
    });

    return {
      items: items.map((item) => mapEntitlement(item)),
      total: items.length,
    };
  }

  async listUserEntitlementsForAdmin(siteId: string, userId: string) {
    await this.ensureStudentUser(siteId, userId);
    const items = await this.prisma.entitlement.findMany({
      where: {
        siteId,
        userId,
      },
      orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
      select: entitlementSelect,
    });

    return {
      items: items.map((item) => mapEntitlement(item)),
      total: items.length,
    };
  }

  async grantEntitlement(actor: AuthenticatedUser, input: GrantEntitlementDto) {
    const targetUser = await this.ensureStudentUser(actor.siteId, input.userId);
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();

    if (input.planId) {
      const plan = await this.plansService.getPlanRecordForSite(
        actor.siteId,
        input.planId,
      );

      if (plan.planEntitlements.length === 0) {
        throw new BadRequestException({
          code: 'PLAN_ENTITLEMENTS_REQUIRED',
          message:
            'This plan does not define any entitlements and cannot be granted.',
        });
      }

      const endsAt = input.endsAt
        ? new Date(input.endsAt)
        : new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60_000);
      const created = await this.prisma.$transaction(
        plan.planEntitlements.map((planEntitlement) =>
          this.prisma.entitlement.create({
            data: {
              siteId: actor.siteId,
              userId: targetUser.id,
              planId: plan.id,
              grantedByUserId: actor.userId,
              sourceType: EntitlementSourceType.ADMIN_GRANT,
              kind: planEntitlement.entitlementKind,
              scopeJson:
                planEntitlement.scopeJson === null
                  ? Prisma.DbNull
                  : (planEntitlement.scopeJson as Prisma.InputJsonValue),
              startsAt,
              endsAt,
              metadataJson:
                input.metadataJson === undefined
                  ? Prisma.DbNull
                  : ({
                      ...input.metadataJson,
                      grantMode: 'plan',
                    } as Prisma.InputJsonValue),
            },
            select: entitlementSelect,
          }),
        ),
      );

      return {
        items: created.map((item) => mapEntitlement(item)),
        total: created.length,
      };
    }

    if (!input.kind) {
      throw new BadRequestException({
        code: 'ENTITLEMENT_KIND_REQUIRED',
        message: 'kind is required when planId is not provided.',
      });
    }

    const created = await this.prisma.entitlement.create({
      data: {
        siteId: actor.siteId,
        userId: targetUser.id,
        grantedByUserId: actor.userId,
        sourceType: EntitlementSourceType.ADMIN_GRANT,
        kind: input.kind,
        scopeJson:
          input.scopeJson === undefined
            ? Prisma.DbNull
            : (input.scopeJson as Prisma.InputJsonValue),
        startsAt,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        metadataJson:
          input.metadataJson === undefined
            ? Prisma.DbNull
            : (input.metadataJson as Prisma.InputJsonValue),
      },
      select: entitlementSelect,
    });

    return {
      items: [mapEntitlement(created)],
      total: 1,
    };
  }

  async revokeEntitlement(
    actor: AuthenticatedUser,
    entitlementId: string,
    input: RevokeEntitlementDto,
  ) {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        id: entitlementId,
        siteId: actor.siteId,
      },
      select: entitlementSelect,
    });

    if (!entitlement) {
      throw new NotFoundException({
        code: 'ENTITLEMENT_NOT_FOUND',
        message: 'Entitlement was not found.',
      });
    }

    const updated = await this.prisma.entitlement.update({
      where: {
        id: entitlement.id,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: input.reason,
      },
      select: entitlementSelect,
    });

    return mapEntitlement(updated);
  }

  async hasEntitlement(
    siteId: string,
    userId: string,
    kinds: EntitlementKind[],
    criteria: EntitlementCriteria = {},
  ) {
    await this.syncSubscriptionStates(siteId, userId);
    const entitlements = await this.getActiveEntitlementRecords(siteId, userId);
    const acceptedKinds = new Set<EntitlementKind>([
      ...kinds,
      EntitlementKind.ALL_PREMIUM,
    ]);

    const hasPurchasedOrGrantedAccess = entitlements.some(
      (entitlement) =>
        acceptedKinds.has(entitlement.kind) &&
        this.matchesScope(entitlement.scopeJson, criteria),
    );

    if (hasPurchasedOrGrantedAccess) {
      return true;
    }

    return this.trialAccessService.hasActiveTrialAccess(siteId, userId);
  }

  async canUsePractice(
    siteId: string,
    userId: string,
    criteria: EntitlementCriteria,
  ) {
    const premiumRequired =
      await this.paymentSettingsService.isPracticePremiumRequired();

    if (!premiumRequired) {
      return {
        allowed: true,
        reason: null as string | null,
      };
    }

    const allowed = await this.hasEntitlement(
      siteId,
      userId,
      [EntitlementKind.PRACTICE_PREMIUM],
      criteria,
    );

    return {
      allowed,
      reason: allowed
        ? null
        : 'Active premium entitlement is required for practice.',
    };
  }

  async syncSubscriptionStates(siteId: string, userId?: string) {
    const now = new Date();
    const filter = userId ? { siteId, userId } : { siteId };

    await this.prisma.subscription.updateMany({
      where: {
        ...filter,
        status: SubscriptionStatus.PENDING,
        startsAt: {
          lte: now,
        },
        endsAt: {
          gt: now,
        },
      },
      data: {
        status: SubscriptionStatus.ACTIVE,
      },
    });

    await this.prisma.subscription.updateMany({
      where: {
        ...filter,
        status: {
          in: [SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE],
        },
        endsAt: {
          lte: now,
        },
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
      },
    });
  }

  async revokeSubscriptionChain(
    siteId: string,
    subscriptionIds: string[],
    revokedReason: string,
  ) {
    if (subscriptionIds.length === 0) {
      return;
    }

    const now = new Date();

    await this.prisma.subscription.updateMany({
      where: {
        siteId,
        id: {
          in: subscriptionIds,
        },
      },
      data: {
        status: SubscriptionStatus.REVOKED,
        revokedAt: now,
        revokedReason,
      },
    });

    await this.prisma.entitlement.updateMany({
      where: {
        siteId,
        subscriptionId: {
          in: subscriptionIds,
        },
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokedReason,
      },
    });
  }

  private async getActiveEntitlementRecords(siteId: string, userId: string) {
    const now = new Date();
    const items = await this.prisma.entitlement.findMany({
      where: {
        siteId,
        userId,
        revokedAt: null,
        startsAt: {
          lte: now,
        },
        OR: [
          {
            endsAt: null,
          },
          {
            endsAt: {
              gt: now,
            },
          },
        ],
      },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
      select: entitlementSelect,
    });

    return items.filter((item) => isActiveEntitlement(item, now));
  }

  private async ensureStudentUser(siteId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        siteId,
      },
      select: {
        id: true,
        userType: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    if (user.userType !== UserType.STUDENT) {
      throw new BadRequestException({
        code: 'ENTITLEMENTS_REQUIRE_STUDENT',
        message: 'Entitlements can only be granted to student users.',
      });
    }

    return user;
  }

  private matchesScope(
    scopeJson: Prisma.JsonValue | null,
    criteria: EntitlementCriteria,
  ) {
    if (
      !scopeJson ||
      typeof scopeJson !== 'object' ||
      Array.isArray(scopeJson)
    ) {
      return true;
    }

    for (const [key, scopeValue] of Object.entries(scopeJson)) {
      if (scopeValue === null || scopeValue === undefined) {
        continue;
      }

      const criteriaValue = criteria[key as keyof EntitlementCriteria];

      if (Array.isArray(scopeValue)) {
        if (Array.isArray(criteriaValue)) {
          const normalizedScope = scopeValue.map((item) => String(item));
          const normalizedCriteria = criteriaValue.map((item) => String(item));
          if (
            !normalizedCriteria.some((item) => normalizedScope.includes(item))
          ) {
            return false;
          }
          continue;
        }

        if (
          criteriaValue === null ||
          criteriaValue === undefined ||
          !scopeValue
            .map((item) => String(item))
            .includes(String(criteriaValue))
        ) {
          return false;
        }

        continue;
      }

      if (Array.isArray(criteriaValue)) {
        if (
          !criteriaValue
            .map((item) => String(item))
            .includes(String(scopeValue))
        ) {
          return false;
        }
        continue;
      }

      if (criteriaValue === null || criteriaValue === undefined) {
        return false;
      }

      if (String(criteriaValue) !== String(scopeValue)) {
        return false;
      }
    }

    return true;
  }
}
