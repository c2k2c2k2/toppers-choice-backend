import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContentStatus,
  FileAssetStatus,
  NoteStatus,
  NoteViewSessionStatus,
  PaymentOrderStatus,
  SecuritySignalSeverity,
  SubscriptionStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SessionService } from '../auth/session.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { ADMIN_OPS_RUNTIME_CONFIG_KEY } from './admin-ops.constants';
import { ListNoteSecuritySignalsQueryDto } from './dto/admin-ops.dto';

@Injectable()
export class AdminOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  async getDashboard(siteId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      students,
      admins,
      activeSubscriptions,
      successfulOrders,
      pendingUploads,
      unreadStudentNotifications,
      recentSecuritySignals,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          siteId,
          userType: UserType.STUDENT,
        },
      }),
      this.prisma.user.count({
        where: {
          siteId,
          userType: UserType.ADMIN,
        },
      }),
      this.prisma.subscription.count({
        where: {
          siteId,
          status: SubscriptionStatus.ACTIVE,
          revokedAt: null,
          endsAt: {
            gt: new Date(),
          },
        },
      }),
      this.prisma.paymentOrder.count({
        where: {
          siteId,
          status: PaymentOrderStatus.SUCCEEDED,
        },
      }),
      this.prisma.fileAsset.count({
        where: {
          siteId,
          status: FileAssetStatus.PENDING_UPLOAD,
        },
      }),
      this.prisma.notificationMessage.count({
        where: {
          siteId,
          status: 'DELIVERED',
          readAt: null,
          user: {
            userType: UserType.STUDENT,
          },
        },
      }),
      this.prisma.noteSecuritySignal.count({
        where: {
          siteId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
    ]);

    return {
      users: {
        students,
        admins,
      },
      commercial: {
        activeSubscriptions,
        successfulOrders,
      },
      operational: {
        pendingUploads,
        unreadStudentNotifications,
        recentSecuritySignals,
      },
    };
  }

  async getContentHealth(siteId: string) {
    const [
      cmsDraftPages,
      cmsDraftSections,
      draftNotes,
      draftStructuredContent,
      draftQuestions,
      draftTests,
      pendingFileUploads,
    ] = await Promise.all([
      this.prisma.cmsPage.count({
        where: {
          siteId,
          status: 'DRAFT',
        },
      }),
      this.prisma.cmsSection.count({
        where: {
          siteId,
          status: 'DRAFT',
        },
      }),
      this.prisma.note.count({
        where: {
          siteId,
          status: NoteStatus.DRAFT,
        },
      }),
      this.prisma.contentEntry.count({
        where: {
          siteId,
          status: ContentStatus.DRAFT,
        },
      }),
      this.prisma.question.count({
        where: {
          siteId,
          status: 'DRAFT',
        },
      }),
      this.prisma.test.count({
        where: {
          siteId,
          status: 'DRAFT',
        },
      }),
      this.prisma.fileAsset.count({
        where: {
          siteId,
          status: FileAssetStatus.PENDING_UPLOAD,
        },
      }),
    ]);

    return {
      cmsDraftPages,
      cmsDraftSections,
      draftNotes,
      draftStructuredContent,
      draftQuestions,
      draftTests,
      pendingFileUploads,
    };
  }

  async listNoteSecuritySignals(
    siteId: string,
    query: ListNoteSecuritySignalsQueryDto,
  ) {
    const take = await this.resolveSignalsLimit(query.take);
    const where = {
      siteId,
      noteId: query.noteId,
      severity: query.severity,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.noteSecuritySignal.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take,
        include: {
          note: {
            select: {
              id: true,
              title: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.noteSecuritySignal.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        noteId: item.noteId,
        noteTitle: item.note.title,
        userId: item.user?.id ?? null,
        userEmail: item.user?.email ?? null,
        signalKey: item.signalKey,
        severity: item.severity,
        metaJson:
          item.metaJson &&
          typeof item.metaJson === 'object' &&
          !Array.isArray(item.metaJson)
            ? (item.metaJson as Record<string, unknown>)
            : null,
        createdAt: item.createdAt,
      })),
      total,
    };
  }

  async exportUsersCsv(siteId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        siteId,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: await this.resolveExportLimit(),
      select: {
        id: true,
        email: true,
        fullName: true,
        userType: true,
        status: true,
        createdAt: true,
      },
    });

    return this.buildCsv(
      ['id', 'email', 'fullName', 'userType', 'status', 'createdAt'],
      users.map((user) => [
        user.id,
        user.email,
        user.fullName,
        user.userType,
        user.status,
        user.createdAt.toISOString(),
      ]),
    );
  }

  async exportSubscriptionsCsv(siteId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        siteId,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: await this.resolveExportLimit(),
      include: {
        plan: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    return this.buildCsv(
      ['id', 'userEmail', 'planName', 'status', 'startsAt', 'endsAt'],
      subscriptions.map((item) => [
        item.id,
        item.user.email,
        item.plan.name,
        item.status,
        item.startsAt.toISOString(),
        item.endsAt.toISOString(),
      ]),
    );
  }

  async exportPaymentsCsv(siteId: string) {
    const orders = await this.prisma.paymentOrder.findMany({
      where: {
        siteId,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: await this.resolveExportLimit(),
      include: {
        user: {
          select: {
            email: true,
          },
        },
        plan: {
          select: {
            name: true,
          },
        },
      },
    });

    return this.buildCsv(
      [
        'id',
        'merchantOrderCode',
        'userEmail',
        'planName',
        'amountPaise',
        'status',
        'createdAt',
      ],
      orders.map((order) => [
        order.id,
        order.merchantOrderCode,
        order.user.email,
        order.plan.name,
        order.amountPaise.toString(),
        order.status,
        order.createdAt.toISOString(),
      ]),
    );
  }

  async revokeUserSessions(siteId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    await this.sessionService.revokeUserSessions(
      user.id,
      'admin_support_action',
    );
    return {
      message: 'User sessions revoked successfully.',
    };
  }

  async revokeNoteViewSession(
    siteId: string,
    noteViewSessionId: string,
    actorUserId: string,
  ) {
    const session = await this.prisma.noteViewSession.findFirst({
      where: {
        id: noteViewSessionId,
        siteId,
      },
      select: {
        id: true,
        noteId: true,
        userId: true,
        status: true,
      },
    });

    if (!session) {
      throw new NotFoundException({
        code: 'NOTE_VIEW_SESSION_NOT_FOUND',
        message: 'Note view session was not found.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.noteViewSession.update({
        where: {
          id: session.id,
        },
        data: {
          status: NoteViewSessionStatus.REVOKED,
          revokedAt: new Date(),
          revokedReason: 'admin_support_action',
        },
      });

      await tx.noteSecuritySignal.create({
        data: {
          siteId,
          noteId: session.noteId,
          userId: session.userId,
          noteViewSessionId: session.id,
          signalKey: 'admin_revoked_view_session',
          severity: SecuritySignalSeverity.MEDIUM,
          metaJson: {
            actorUserId,
          },
        },
      });
    });

    return {
      message: 'Note view session revoked successfully.',
    };
  }

  private async resolveExportLimit() {
    return this.siteSettingsService.getNumberSetting(
      ADMIN_OPS_RUNTIME_CONFIG_KEY,
      'exports.maxRows',
      {
        fallback: 5_000,
        min: 100,
        max: 50_000,
        integer: true,
      },
    );
  }

  private async resolveSignalsLimit(requestedTake?: number) {
    const defaultTake = await this.siteSettingsService.getNumberSetting(
      ADMIN_OPS_RUNTIME_CONFIG_KEY,
      'security.defaultSignalRows',
      {
        fallback: 25,
        min: 5,
        max: 200,
        integer: true,
      },
    );

    if (!requestedTake) {
      return defaultTake;
    }

    return Math.min(requestedTake, defaultTake);
  }

  private buildCsv(headers: string[], rows: string[][]) {
    const csvRows = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => this.escapeCsv(cell)).join(',')),
    ];

    return csvRows.join('\n');
  }

  private escapeCsv(value: string) {
    const normalized = value.replace(/"/gu, '""');
    return `"${normalized}"`;
  }
}
