import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationAudienceType,
  NotificationBroadcastStatus,
  NotificationChannel,
  NotificationMessageStatus,
  NotificationTemplateStatus,
  Prisma,
  SubscriptionStatus,
  UserStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../infra/idempotency/idempotency.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { NOTIFICATIONS_RUNTIME_CONFIG_KEY } from './notifications.constants';
import {
  CreateNotificationBroadcastDto,
  CreateNotificationTemplateDto,
  ListAdminNotificationBroadcastsQueryDto,
  ListAdminNotificationMessagesQueryDto,
  ListAdminNotificationTemplatesQueryDto,
  ListMyNotificationsQueryDto,
  UpdateNotificationBroadcastDto,
  UpdateNotificationPreferencesDto,
  UpdateNotificationTemplateDto,
} from './dto/manage-notifications.dto';

const DEFAULT_NOTIFICATION_CHANNELS = [
  NotificationChannel.IN_APP,
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
] as const;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async listMyNotifications(
    user: AuthenticatedUser,
    query: ListMyNotificationsQueryDto,
  ) {
    const take = query.take ?? (await this.getFeedLimit());
    const [items, unreadCount] = await this.prisma.$transaction([
      this.prisma.notificationMessage.findMany({
        where: {
          siteId: user.siteId,
          userId: user.userId,
          channel: NotificationChannel.IN_APP,
          status: {
            in: [
              NotificationMessageStatus.DELIVERED,
              NotificationMessageStatus.READ,
            ],
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take,
      }),
      this.prisma.notificationMessage.count({
        where: {
          siteId: user.siteId,
          userId: user.userId,
          channel: NotificationChannel.IN_APP,
          status: NotificationMessageStatus.DELIVERED,
          readAt: null,
        },
      }),
    ]);

    return {
      items: items.map((item) => this.mapMessage(item)),
      unreadCount,
    };
  }

  async markMessageRead(user: AuthenticatedUser, messageId: string) {
    const message = await this.prisma.notificationMessage.findFirst({
      where: {
        id: messageId,
        siteId: user.siteId,
        userId: user.userId,
      },
    });

    if (!message) {
      throw this.notFound(
        'NOTIFICATION_MESSAGE_NOT_FOUND',
        'Notification message was not found.',
      );
    }

    const updated = await this.prisma.notificationMessage.update({
      where: { id: message.id },
      data: {
        status: NotificationMessageStatus.READ,
        readAt: message.readAt ?? new Date(),
      },
    });

    await this.refreshBroadcastStats(updated.broadcastId);
    return this.mapMessage(updated);
  }

  async markAllRead(user: AuthenticatedUser) {
    await this.prisma.notificationMessage.updateMany({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        channel: NotificationChannel.IN_APP,
        status: NotificationMessageStatus.DELIVERED,
        readAt: null,
      },
      data: {
        status: NotificationMessageStatus.READ,
        readAt: new Date(),
      },
    });

    return {
      message: 'Notifications marked as read.',
    };
  }

  async getPreferences(user: AuthenticatedUser) {
    await this.ensureDefaultPreferences(user.siteId, user.userId);

    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        siteId: user.siteId,
        userId: user.userId,
      },
      orderBy: {
        channel: 'asc',
      },
    });

    return preferences.map((item) => ({
      channel: item.channel,
      isEnabled: item.isEnabled,
    }));
  }

  async updatePreferences(
    user: AuthenticatedUser,
    input: UpdateNotificationPreferencesDto,
  ) {
    await this.ensureDefaultPreferences(user.siteId, user.userId);

    await this.prisma.$transaction(
      input.items.map((item) =>
        this.prisma.notificationPreference.upsert({
          where: {
            userId_channel: {
              userId: user.userId,
              channel: item.channel,
            },
          },
          update: {
            isEnabled: item.isEnabled,
          },
          create: {
            siteId: user.siteId,
            userId: user.userId,
            channel: item.channel,
            isEnabled: item.isEnabled,
          },
        }),
      ),
    );

    return this.getPreferences(user);
  }

  async listTemplates(
    siteId: string,
    query: ListAdminNotificationTemplatesQueryDto,
  ) {
    const where: Prisma.NotificationTemplateWhereInput = {
      siteId,
      channel: query.channel,
      status: query.status,
      OR: query.q
        ? [
            { key: { contains: query.q, mode: 'insensitive' } },
            { name: { contains: query.q, mode: 'insensitive' } },
            { titleTemplate: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationTemplate.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
      }),
      this.prisma.notificationTemplate.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapTemplate(item)),
      total,
    };
  }

  async createTemplate(
    user: AuthenticatedUser,
    input: CreateNotificationTemplateDto,
  ) {
    const template = await this.prisma.notificationTemplate.create({
      data: {
        siteId: user.siteId,
        key: input.key.trim(),
        name: input.name.trim(),
        channel: input.channel ?? NotificationChannel.IN_APP,
        subjectTemplate: input.subjectTemplate?.trim() ?? null,
        titleTemplate: input.titleTemplate.trim(),
        bodyTemplate: input.bodyTemplate.trim(),
        metaJson:
          input.metaJson === undefined
            ? Prisma.DbNull
            : (input.metaJson as Prisma.InputJsonValue),
        status: input.status ?? NotificationTemplateStatus.ACTIVE,
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
    });

    return this.mapTemplate(template);
  }

  async updateTemplate(
    user: AuthenticatedUser,
    templateId: string,
    input: UpdateNotificationTemplateDto,
  ) {
    const template = await this.prisma.notificationTemplate.update({
      where: {
        id: templateId,
      },
      data: {
        key: input.key?.trim(),
        name: input.name?.trim(),
        channel: input.channel,
        subjectTemplate:
          input.subjectTemplate === undefined
            ? undefined
            : (input.subjectTemplate?.trim() ?? null),
        titleTemplate: input.titleTemplate?.trim(),
        bodyTemplate: input.bodyTemplate?.trim(),
        metaJson:
          input.metaJson === undefined
            ? undefined
            : input.metaJson === null
              ? Prisma.DbNull
              : (input.metaJson as Prisma.InputJsonValue),
        status: input.status,
        updatedByUserId: user.userId,
      },
    });

    return this.mapTemplate(template);
  }

  async listBroadcasts(
    siteId: string,
    query: ListAdminNotificationBroadcastsQueryDto,
  ) {
    const where: Prisma.NotificationBroadcastWhereInput = {
      siteId,
      status: query.status,
      audienceType: query.audienceType,
      channel: query.channel,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationBroadcast.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.notificationBroadcast.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapBroadcast(item)),
      total,
    };
  }

  async getBroadcast(siteId: string, broadcastId: string) {
    const broadcast = await this.prisma.notificationBroadcast.findFirst({
      where: {
        id: broadcastId,
        siteId,
      },
    });

    if (!broadcast) {
      throw this.notFound(
        'NOTIFICATION_BROADCAST_NOT_FOUND',
        'Notification broadcast was not found.',
      );
    }

    return this.mapBroadcast(broadcast);
  }

  async createBroadcast(
    user: AuthenticatedUser,
    input: CreateNotificationBroadcastDto,
  ) {
    await this.assertValidBroadcastAudience(user.siteId, input);

    const broadcast = await this.prisma.notificationBroadcast.create({
      data: {
        siteId: user.siteId,
        templateId: input.templateId ?? null,
        audienceType: input.audienceType,
        channel: input.channel ?? NotificationChannel.IN_APP,
        title: input.title.trim(),
        body: input.body.trim(),
        filtersJson:
          input.filtersJson === undefined
            ? Prisma.DbNull
            : (input.filtersJson as Prisma.InputJsonValue),
        payloadJson:
          input.payloadJson === undefined
            ? Prisma.DbNull
            : (input.payloadJson as Prisma.InputJsonValue),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status: NotificationBroadcastStatus.DRAFT,
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
    });

    return this.mapBroadcast(broadcast);
  }

  async updateBroadcast(
    user: AuthenticatedUser,
    broadcastId: string,
    input: UpdateNotificationBroadcastDto,
  ) {
    const existing = await this.prisma.notificationBroadcast.findFirst({
      where: {
        id: broadcastId,
        siteId: user.siteId,
      },
    });

    if (!existing) {
      throw this.notFound(
        'NOTIFICATION_BROADCAST_NOT_FOUND',
        'Notification broadcast was not found.',
      );
    }

    if (existing.status === NotificationBroadcastStatus.SENT) {
      throw new BadRequestException({
        code: 'NOTIFICATION_BROADCAST_SENT',
        message: 'Broadcasts cannot be edited after dispatch.',
      });
    }

    await this.assertValidBroadcastAudience(user.siteId, {
      templateId: input.templateId ?? existing.templateId ?? undefined,
      audienceType: input.audienceType ?? existing.audienceType,
      channel: input.channel ?? existing.channel,
      title: input.title ?? existing.title,
      body: input.body ?? existing.body,
      filtersJson:
        input.filtersJson === undefined
          ? (this.toObject(existing.filtersJson) ?? undefined)
          : input.filtersJson,
      payloadJson:
        input.payloadJson === undefined
          ? (this.toObject(existing.payloadJson) ?? undefined)
          : input.payloadJson,
    });

    const broadcast = await this.prisma.notificationBroadcast.update({
      where: {
        id: broadcastId,
      },
      data: {
        templateId:
          input.templateId === undefined
            ? undefined
            : (input.templateId ?? null),
        audienceType: input.audienceType,
        channel: input.channel,
        title: input.title?.trim(),
        body: input.body?.trim(),
        filtersJson:
          input.filtersJson === undefined
            ? undefined
            : input.filtersJson === null
              ? Prisma.DbNull
              : (input.filtersJson as Prisma.InputJsonValue),
        payloadJson:
          input.payloadJson === undefined
            ? undefined
            : input.payloadJson === null
              ? Prisma.DbNull
              : (input.payloadJson as Prisma.InputJsonValue),
        scheduledAt:
          input.scheduledAt === undefined
            ? undefined
            : input.scheduledAt
              ? new Date(input.scheduledAt)
              : null,
        updatedByUserId: user.userId,
      },
    });

    return this.mapBroadcast(broadcast);
  }

  async dispatchBroadcast(
    user: AuthenticatedUser,
    broadcastId: string,
    idempotencyKey?: string | null,
  ) {
    return this.idempotencyService.execute(
      {
        siteId: user.siteId,
        userId: user.userId,
        scope: 'notifications.dispatch',
        key: idempotencyKey,
        requestBody: {
          broadcastId,
        },
        resourceType: 'notification_broadcast',
        ttlMinutes: 120,
      },
      async () => {
        const broadcast = await this.prisma.notificationBroadcast.findFirst({
          where: {
            id: broadcastId,
            siteId: user.siteId,
          },
        });

        if (!broadcast) {
          throw this.notFound(
            'NOTIFICATION_BROADCAST_NOT_FOUND',
            'Notification broadcast was not found.',
          );
        }

        if (broadcast.status === NotificationBroadcastStatus.CANCELLED) {
          throw new BadRequestException({
            code: 'NOTIFICATION_BROADCAST_CANCELLED',
            message: 'Cancelled broadcasts cannot be dispatched.',
          });
        }

        if (broadcast.status === NotificationBroadcastStatus.SENT) {
          return this.mapBroadcast(broadcast);
        }

        const targetUsers = await this.resolveBroadcastAudience(
          user.siteId,
          broadcast.audienceType,
          this.toObject(broadcast.filtersJson),
        );
        const maxRecipients = await this.getMaxBroadcastRecipients();

        if (targetUsers.length > maxRecipients) {
          throw new BadRequestException({
            code: 'NOTIFICATION_BROADCAST_TOO_LARGE',
            message:
              'Resolved audience exceeds the current broadcast recipient limit.',
          });
        }

        const enabledUserIds = await this.filterEnabledRecipients(
          user.siteId,
          targetUsers.map((item) => item.id),
          broadcast.channel,
        );
        const deliveredAt =
          broadcast.channel === NotificationChannel.IN_APP ? new Date() : null;
        const messageStatus =
          broadcast.channel === NotificationChannel.IN_APP
            ? NotificationMessageStatus.DELIVERED
            : NotificationMessageStatus.PENDING;

        await this.prisma.$transaction(async (tx) => {
          await tx.notificationBroadcast.update({
            where: { id: broadcast.id },
            data: {
              status: NotificationBroadcastStatus.QUEUED,
              updatedByUserId: user.userId,
            },
          });

          if (enabledUserIds.length > 0) {
            await tx.notificationMessage.createMany({
              data: enabledUserIds.map((userId) => ({
                siteId: user.siteId,
                userId,
                templateId: broadcast.templateId,
                broadcastId: broadcast.id,
                channel: broadcast.channel,
                title: broadcast.title,
                body: broadcast.body,
                payloadJson:
                  broadcast.payloadJson === null
                    ? undefined
                    : (broadcast.payloadJson as Prisma.InputJsonValue),
                status: messageStatus,
                deliveredAt,
              })),
            });
          }

          await tx.notificationBroadcast.update({
            where: { id: broadcast.id },
            data: {
              status: NotificationBroadcastStatus.SENT,
              dispatchedAt: new Date(),
              dispatchedByUserId: user.userId,
              recipientCount: enabledUserIds.length,
              deliveredCount:
                messageStatus === NotificationMessageStatus.DELIVERED
                  ? enabledUserIds.length
                  : 0,
              readCount: 0,
              updatedByUserId: user.userId,
            },
          });
        });

        return this.getBroadcast(user.siteId, broadcast.id);
      },
    );
  }

  async cancelBroadcast(user: AuthenticatedUser, broadcastId: string) {
    const existing = await this.prisma.notificationBroadcast.findFirst({
      where: {
        id: broadcastId,
        siteId: user.siteId,
      },
    });

    if (!existing) {
      throw this.notFound(
        'NOTIFICATION_BROADCAST_NOT_FOUND',
        'Notification broadcast was not found.',
      );
    }

    if (existing.status === NotificationBroadcastStatus.SENT) {
      throw new BadRequestException({
        code: 'NOTIFICATION_BROADCAST_ALREADY_SENT',
        message: 'Sent broadcasts cannot be cancelled.',
      });
    }

    const broadcast = await this.prisma.notificationBroadcast.update({
      where: { id: existing.id },
      data: {
        status: NotificationBroadcastStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedByUserId: user.userId,
      },
    });

    return this.mapBroadcast(broadcast);
  }

  async listMessages(
    siteId: string,
    query: ListAdminNotificationMessagesQueryDto,
  ) {
    const where: Prisma.NotificationMessageWhereInput = {
      siteId,
      status: query.status,
      channel: query.channel,
      userId: query.userId,
      broadcastId: query.broadcastId,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationMessage.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.notificationMessage.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapMessage(item)),
      total,
    };
  }

  private async ensureDefaultPreferences(siteId: string, userId: string) {
    await this.prisma.notificationPreference.createMany({
      data: DEFAULT_NOTIFICATION_CHANNELS.map((channel) => ({
        siteId,
        userId,
        channel,
        isEnabled: true,
      })),
      skipDuplicates: true,
    });
  }

  private async getFeedLimit() {
    return this.siteSettingsService.getNumberSetting(
      NOTIFICATIONS_RUNTIME_CONFIG_KEY,
      'feed.maxItems',
      {
        fallback: 25,
        min: 5,
        max: 100,
        integer: true,
      },
    );
  }

  private async getMaxBroadcastRecipients() {
    return this.siteSettingsService.getNumberSetting(
      NOTIFICATIONS_RUNTIME_CONFIG_KEY,
      'broadcast.maxRecipients',
      {
        fallback: 5_000,
        min: 1,
        max: 50_000,
        integer: true,
      },
    );
  }

  private async assertValidBroadcastAudience(
    siteId: string,
    input: {
      templateId?: string;
      audienceType: NotificationAudienceType;
      channel?: NotificationChannel;
      title: string;
      body: string;
      filtersJson?: Record<string, unknown>;
      payloadJson?: Record<string, unknown>;
    },
  ) {
    if (input.templateId) {
      const template = await this.prisma.notificationTemplate.findFirst({
        where: {
          id: input.templateId,
          siteId,
        },
        select: {
          id: true,
        },
      });

      if (!template) {
        throw this.notFound(
          'NOTIFICATION_TEMPLATE_NOT_FOUND',
          'Notification template was not found.',
        );
      }
    }

    if (input.audienceType === NotificationAudienceType.USER_IDS) {
      const userIds = this.extractUserIds(input.filtersJson);
      if (userIds.length === 0) {
        throw new BadRequestException({
          code: 'NOTIFICATION_AUDIENCE_USER_IDS_REQUIRED',
          message:
            'Broadcasts targeting explicit users must include filtersJson.userIds.',
        });
      }
    }
  }

  private async resolveBroadcastAudience(
    siteId: string,
    audienceType: NotificationAudienceType,
    filtersJson: Record<string, unknown> | null,
  ) {
    if (audienceType === NotificationAudienceType.ALL_STUDENTS) {
      return this.prisma.user.findMany({
        where: {
          siteId,
          userType: UserType.STUDENT,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });
    }

    if (audienceType === NotificationAudienceType.ALL_ADMINS) {
      return this.prisma.user.findMany({
        where: {
          siteId,
          userType: UserType.ADMIN,
          status: UserStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });
    }

    if (audienceType === NotificationAudienceType.ACTIVE_SUBSCRIBERS) {
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          siteId,
          status: SubscriptionStatus.ACTIVE,
          revokedAt: null,
          endsAt: {
            gt: new Date(),
          },
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
      });

      return subscriptions.map((item) => ({
        id: item.userId,
      }));
    }

    const userIds = this.extractUserIds(filtersJson);
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        siteId,
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
      },
    });
  }

  private async filterEnabledRecipients(
    siteId: string,
    userIds: string[],
    channel: NotificationChannel,
  ) {
    if (userIds.length === 0) {
      return [];
    }

    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        siteId,
        userId: {
          in: userIds,
        },
        channel,
      },
      select: {
        userId: true,
        isEnabled: true,
      },
    });

    const explicitPreferences = new Map(
      preferences.map((item) => [item.userId, item.isEnabled]),
    );

    return userIds.filter((userId) => explicitPreferences.get(userId) ?? true);
  }

  private async refreshBroadcastStats(broadcastId: string | null) {
    if (!broadcastId) {
      return;
    }

    const [recipientCount, deliveredCount, readCount] = await Promise.all([
      this.prisma.notificationMessage.count({
        where: {
          broadcastId,
        },
      }),
      this.prisma.notificationMessage.count({
        where: {
          broadcastId,
          status: {
            in: [
              NotificationMessageStatus.DELIVERED,
              NotificationMessageStatus.READ,
            ],
          },
        },
      }),
      this.prisma.notificationMessage.count({
        where: {
          broadcastId,
          status: NotificationMessageStatus.READ,
        },
      }),
    ]);

    await this.prisma.notificationBroadcast.update({
      where: {
        id: broadcastId,
      },
      data: {
        recipientCount,
        deliveredCount,
        readCount,
      },
    });
  }

  private extractUserIds(
    filtersJson: Record<string, unknown> | null | undefined,
  ) {
    const rawUserIds = filtersJson?.userIds;
    if (!Array.isArray(rawUserIds)) {
      return [];
    }

    return rawUserIds.filter(
      (item): item is string => typeof item === 'string',
    );
  }

  private toObject(value: Prisma.JsonValue | null) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }

  private mapMessage(
    item: Prisma.NotificationMessageGetPayload<Record<string, never>>,
  ) {
    return {
      id: item.id,
      channel: item.channel,
      title: item.title,
      body: item.body,
      payloadJson: this.toObject(item.payloadJson),
      status: item.status,
      deliveredAt: item.deliveredAt,
      readAt: item.readAt,
      broadcastId: item.broadcastId,
      createdAt: item.createdAt,
    };
  }

  private mapTemplate(
    item: Prisma.NotificationTemplateGetPayload<Record<string, never>>,
  ) {
    return {
      id: item.id,
      key: item.key,
      name: item.name,
      channel: item.channel,
      subjectTemplate: item.subjectTemplate,
      titleTemplate: item.titleTemplate,
      bodyTemplate: item.bodyTemplate,
      metaJson: this.toObject(item.metaJson),
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private mapBroadcast(
    item: Prisma.NotificationBroadcastGetPayload<Record<string, never>>,
  ) {
    return {
      id: item.id,
      templateId: item.templateId,
      audienceType: item.audienceType,
      channel: item.channel,
      title: item.title,
      body: item.body,
      filtersJson: this.toObject(item.filtersJson),
      payloadJson: this.toObject(item.payloadJson),
      scheduledAt: item.scheduledAt,
      dispatchedAt: item.dispatchedAt,
      cancelledAt: item.cancelledAt,
      status: item.status,
      recipientCount: item.recipientCount,
      deliveredCount: item.deliveredCount,
      readCount: item.readCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private notFound(code: string, message: string) {
    return new NotFoundException({
      code,
      message,
    });
  }
}
