import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, TrialAccessStatus, UserType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { PaymentSettingsService } from './payment-settings.service';

type TrialPolicy = Awaited<ReturnType<PaymentSettingsService['getTrialPolicy']>>;

type TrialAccessRecord = {
  id: string;
  siteId: string;
  userId: string;
  status: TrialAccessStatus;
  consumedSeconds: number;
  startedAt: Date | null;
  lastHeartbeatAt: Date | null;
  lastStoppedAt: Date | null;
  exhaustedAt: Date | null;
  disabledAt: Date | null;
};

@Injectable()
export class TrialAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentSettingsService: PaymentSettingsService,
  ) {}

  async getCurrentTrial(user: AuthenticatedUser) {
    this.assertStudentUser(user);
    const [policy, trial] = await Promise.all([
      this.paymentSettingsService.getTrialPolicy(),
      this.prisma.trialAccess.findUnique({
        where: {
          siteId_userId: {
            siteId: user.siteId,
            userId: user.userId,
          },
        },
        select: trialAccessSelect,
      }),
    ]);

    return this.mapTrial(trial, policy);
  }

  async startTrial(user: AuthenticatedUser) {
    this.assertStudentUser(user);
    const policy = await this.paymentSettingsService.getTrialPolicy();
    const now = new Date();

    const trial = await this.prisma.$transaction(async (tx) => {
      const record = await this.getOrCreateTrialAccess(tx, user, now);
      const mapped = this.mapTrial(record, policy);

      if (!mapped.enabled) {
        return record;
      }

      if (mapped.remainingSeconds <= 0) {
        return this.markExhaustedIfNeeded(tx, record, policy, now);
      }

      const updated = await tx.trialAccess.update({
        where: { id: record.id },
        data: {
          status: TrialAccessStatus.ACTIVE,
          startedAt: record.startedAt ?? now,
          lastHeartbeatAt: now,
          lastStoppedAt: null,
          exhaustedAt: null,
        },
        select: trialAccessSelect,
      });

      await this.recordUsageEvent(tx, updated, policy, 'START', 0, now);

      return updated;
    });

    return this.mapTrial(trial, policy);
  }

  async heartbeat(user: AuthenticatedUser) {
    this.assertStudentUser(user);
    const policy = await this.paymentSettingsService.getTrialPolicy();
    const now = new Date();

    const trial = await this.prisma.$transaction(async (tx) => {
      const record = await this.getOrCreateTrialAccess(tx, user, now);
      if (!policy.enabled) {
        return record;
      }

      const chargedSeconds = this.resolveChargedSeconds(record, policy, now);
      const nextConsumedSeconds = Math.min(
        record.consumedSeconds + chargedSeconds,
        policy.totalSeconds,
      );
      const exhaustedAt =
        nextConsumedSeconds >= policy.totalSeconds ? (record.exhaustedAt ?? now) : null;

      const updated = await tx.trialAccess.update({
        where: { id: record.id },
        data: {
          status:
            nextConsumedSeconds >= policy.totalSeconds
              ? TrialAccessStatus.EXHAUSTED
              : TrialAccessStatus.ACTIVE,
          consumedSeconds: nextConsumedSeconds,
          startedAt: record.startedAt ?? now,
          lastHeartbeatAt: now,
          lastStoppedAt: null,
          exhaustedAt,
        },
        select: trialAccessSelect,
      });

      await this.recordUsageEvent(
        tx,
        updated,
        policy,
        'HEARTBEAT',
        chargedSeconds,
        now,
      );

      return updated;
    });

    return this.mapTrial(trial, policy);
  }

  async stopTrial(user: AuthenticatedUser) {
    this.assertStudentUser(user);
    const policy = await this.paymentSettingsService.getTrialPolicy();
    const now = new Date();

    const trial = await this.prisma.$transaction(async (tx) => {
      const record = await tx.trialAccess.findUnique({
        where: {
          siteId_userId: {
            siteId: user.siteId,
            userId: user.userId,
          },
        },
        select: trialAccessSelect,
      });

      if (!record) {
        return this.getOrCreateTrialAccess(tx, user, now);
      }

      if (!policy.enabled) {
        return record;
      }

      const chargedSeconds = this.resolveChargedSeconds(record, policy, now);
      const nextConsumedSeconds = Math.min(
        record.consumedSeconds + chargedSeconds,
        policy.totalSeconds,
      );
      const exhaustedAt =
        nextConsumedSeconds >= policy.totalSeconds ? (record.exhaustedAt ?? now) : null;

      const updated = await tx.trialAccess.update({
        where: { id: record.id },
        data: {
          status:
            nextConsumedSeconds >= policy.totalSeconds
              ? TrialAccessStatus.EXHAUSTED
              : TrialAccessStatus.ACTIVE,
          consumedSeconds: nextConsumedSeconds,
          lastHeartbeatAt: null,
          lastStoppedAt: now,
          exhaustedAt,
        },
        select: trialAccessSelect,
      });

      await this.recordUsageEvent(
        tx,
        updated,
        policy,
        'STOP',
        chargedSeconds,
        now,
      );

      return updated;
    });

    return this.mapTrial(trial, policy);
  }

  async hasActiveTrialAccess(siteId: string, userId: string) {
    const policy = await this.paymentSettingsService.getTrialPolicy();

    if (!policy.enabled || policy.totalSeconds <= 0) {
      return false;
    }

    const trial = await this.prisma.trialAccess.findUnique({
      where: {
        siteId_userId: {
          siteId,
          userId,
        },
      },
      select: trialAccessSelect,
    });

    if (!trial) {
      return true;
    }

    return this.mapTrial(trial, policy).hasAccess;
  }

  private async getOrCreateTrialAccess(
    tx: Prisma.TransactionClient,
    user: AuthenticatedUser,
    now: Date,
  ) {
    try {
      return await tx.trialAccess.upsert({
        where: {
          siteId_userId: {
            siteId: user.siteId,
            userId: user.userId,
          },
        },
        update: {},
        create: {
          siteId: user.siteId,
          userId: user.userId,
          startedAt: now,
          metadataJson: {
            source: 'student_trial',
          } satisfies Prisma.JsonObject,
        },
        select: trialAccessSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingTrial = await tx.trialAccess.findUnique({
          where: {
            siteId_userId: {
              siteId: user.siteId,
              userId: user.userId,
            },
          },
          select: trialAccessSelect,
        });

        if (existingTrial) {
          return existingTrial;
        }
      }

      throw error;
    }
  }

  private async markExhaustedIfNeeded(
    tx: Prisma.TransactionClient,
    record: TrialAccessRecord,
    policy: TrialPolicy,
    now: Date,
  ) {
    if (record.status === TrialAccessStatus.EXHAUSTED) {
      return record;
    }

    return tx.trialAccess.update({
      where: { id: record.id },
      data: {
        status: TrialAccessStatus.EXHAUSTED,
        exhaustedAt: record.exhaustedAt ?? now,
      },
      select: trialAccessSelect,
    });
  }

  private resolveChargedSeconds(
    record: TrialAccessRecord,
    policy: TrialPolicy,
    now: Date,
  ) {
    if (
      !policy.enabled ||
      policy.totalSeconds <= 0 ||
      record.status === TrialAccessStatus.EXHAUSTED
    ) {
      return 0;
    }

    const previousAt = record.lastHeartbeatAt;
    if (!previousAt) {
      return 0;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - previousAt.getTime()) / 1000),
    );

    return Math.min(elapsedSeconds, policy.maxHeartbeatGapSeconds);
  }

  private async recordUsageEvent(
    tx: Prisma.TransactionClient,
    record: TrialAccessRecord,
    policy: TrialPolicy,
    eventType: string,
    chargedSeconds: number,
    occurredAt: Date,
  ) {
    const remainingSeconds = Math.max(
      0,
      policy.totalSeconds - record.consumedSeconds,
    );

    await tx.trialUsageEvent.create({
      data: {
        siteId: record.siteId,
        userId: record.userId,
        trialAccessId: record.id,
        eventType,
        chargedSeconds,
        consumedSeconds: record.consumedSeconds,
        remainingSeconds,
        occurredAt,
        metadataJson: {
          policyTotalSeconds: policy.totalSeconds,
          policyHeartbeatSeconds: policy.heartbeatSeconds,
          policyMaxHeartbeatGapSeconds: policy.maxHeartbeatGapSeconds,
        } satisfies Prisma.JsonObject,
      },
    });
  }

  private mapTrial(record: TrialAccessRecord | null, policy: TrialPolicy) {
    const consumedSeconds = record?.consumedSeconds ?? 0;
    const remainingSeconds = Math.max(0, policy.totalSeconds - consumedSeconds);
    const hasAccess =
      policy.enabled &&
      remainingSeconds > 0 &&
      record?.status !== TrialAccessStatus.EXHAUSTED &&
      record?.status !== TrialAccessStatus.DISABLED;

    return {
      id: record?.id ?? null,
      status: policy.enabled
        ? (record?.status ?? TrialAccessStatus.ACTIVE)
        : TrialAccessStatus.DISABLED,
      enabled: policy.enabled,
      consumedSeconds,
      remainingSeconds,
      totalSeconds: policy.totalSeconds,
      hasAccess,
      startedAt: record?.startedAt ?? null,
      lastHeartbeatAt: record?.lastHeartbeatAt ?? null,
      lastStoppedAt: record?.lastStoppedAt ?? null,
      exhaustedAt: record?.exhaustedAt ?? null,
      disabledAt: record?.disabledAt ?? null,
      policy,
    };
  }

  private assertStudentUser(user: AuthenticatedUser) {
    if (user.userType !== UserType.STUDENT) {
      throw new ConflictException({
        code: 'TRIAL_STUDENT_ONLY',
        message: 'Only student accounts can use trial access.',
      });
    }
  }
}

const trialAccessSelect = Prisma.validator<Prisma.TrialAccessSelect>()({
  id: true,
  siteId: true,
  userId: true,
  status: true,
  consumedSeconds: true,
  startedAt: true,
  lastHeartbeatAt: true,
  lastStoppedAt: true,
  exhaustedAt: true,
  disabledAt: true,
});
