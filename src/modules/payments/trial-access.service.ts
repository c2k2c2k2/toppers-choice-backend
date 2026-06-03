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

      if (!mapped.hasAccess) {
        return this.markExhaustedIfNeeded(tx, record, policy, now);
      }

      return tx.trialAccess.update({
        where: { id: record.id },
        data: {
          status: TrialAccessStatus.ACTIVE,
          startedAt: record.startedAt ?? now,
          lastHeartbeatAt: null,
          lastStoppedAt: null,
          exhaustedAt: null,
        },
        select: trialAccessSelect,
      });
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

      if (!this.mapTrial(record, policy, now).hasAccess) {
        return this.markExhaustedIfNeeded(tx, record, policy, now);
      }

      return record;
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

      if (!this.mapTrial(record, policy, now).hasAccess) {
        return this.markExhaustedIfNeeded(tx, record, policy, now);
      }

      return tx.trialAccess.update({
        where: { id: record.id },
        data: {
          lastHeartbeatAt: null,
          lastStoppedAt: now,
        },
        select: trialAccessSelect,
      });
    });

    return this.mapTrial(trial, policy);
  }

  async hasActiveTrialAccess(siteId: string, userId: string) {
    const policy = await this.paymentSettingsService.getTrialPolicy();

    if (!policy.enabled || policy.totalSeconds <= 0) {
      return false;
    }

    const now = new Date();
    const trial = await this.prisma.$transaction(async (tx) => {
      const record = await tx.trialAccess.upsert({
        where: {
          siteId_userId: {
            siteId,
            userId,
          },
        },
        update: {},
        create: {
          siteId,
          userId,
          startedAt: now,
          metadataJson: {
            source: 'student_trial',
            autoStartedBy: 'entitlement_gate',
          } satisfies Prisma.JsonObject,
        },
        select: trialAccessSelect,
      });

      if (!this.mapTrial(record, policy, now).hasAccess) {
        return this.markExhaustedIfNeeded(tx, record, policy, now);
      }

      return record;
    });

    return this.mapTrial(trial, policy, now).hasAccess;
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

  private mapTrial(
    record: TrialAccessRecord | null,
    policy: TrialPolicy,
    now = new Date(),
  ) {
    const startedAt = record?.startedAt ?? null;
    const elapsedSeconds = startedAt
      ? Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000))
      : 0;
    const consumedSeconds = Math.min(policy.totalSeconds, elapsedSeconds);
    const remainingSeconds = Math.max(0, policy.totalSeconds - consumedSeconds);
    const expiresAt =
      startedAt && policy.totalSeconds > 0
        ? new Date(startedAt.getTime() + policy.totalSeconds * 1000)
        : null;
    const hasAccess =
      policy.enabled &&
      remainingSeconds > 0 &&
      record?.status !== TrialAccessStatus.EXHAUSTED &&
      record?.status !== TrialAccessStatus.DISABLED;

    return {
      id: record?.id ?? null,
      status: policy.enabled
        ? remainingSeconds > 0
          ? (record?.status ?? TrialAccessStatus.ACTIVE)
          : TrialAccessStatus.EXHAUSTED
        : TrialAccessStatus.DISABLED,
      enabled: policy.enabled,
      consumedSeconds,
      remainingSeconds,
      totalSeconds: policy.totalSeconds,
      hasAccess,
      startedAt,
      expiresAt,
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
