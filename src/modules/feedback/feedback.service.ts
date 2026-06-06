import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedbackStatus,
  FileAssetPurpose,
  FileAssetStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser, RequestSessionMetadata } from '../auth/auth.types';
import {
  CreateFeedbackDto,
  ListFeedbackQueryDto,
  UpdateFeedbackDto,
} from './dto/manage-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async createFeedback(
    user: AuthenticatedUser,
    input: CreateFeedbackDto,
    metadata: RequestSessionMetadata,
  ) {
    const attachmentIds = input.attachments?.map((item) => item.fileAssetId) ?? [];
    await this.assertAttachments(user.siteId, attachmentIds);

    const feedback = await this.prisma.feedbackTicket.create({
      data: {
        siteId: user.siteId,
        userId: user.userId,
        category: input.category,
        subject: input.subject.trim(),
        message: input.message.trim(),
        pageUrl: input.pageUrl ?? null,
        pageTitle: input.pageTitle ?? null,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        contextJson:
          input.contextJson === undefined
            ? Prisma.DbNull
            : (input.contextJson as Prisma.InputJsonValue),
        attachments:
          input.attachments && input.attachments.length > 0
            ? {
                create: input.attachments.map((attachment) => ({
                  siteId: user.siteId,
                  fileAssetId: attachment.fileAssetId,
                  label: attachment.label ?? null,
                })),
              }
            : undefined,
      },
      include: feedbackInclude,
    });

    return mapFeedback(feedback);
  }

  async listMyFeedback(user: AuthenticatedUser, query: ListFeedbackQueryDto) {
    const where: Prisma.FeedbackTicketWhereInput = {
      siteId: user.siteId,
      userId: user.userId,
      status: query.status,
      category: query.category,
      priority: query.priority,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedbackTicket.findMany({
        where,
        include: feedbackInclude,
        orderBy: [{ createdAt: 'desc' }],
        take: query.take ?? 25,
      }),
      this.prisma.feedbackTicket.count({ where }),
    ]);

    return {
      items: items.map((item) => mapFeedback(item)),
      total,
    };
  }

  async listAdminFeedback(siteId: string, query: ListFeedbackQueryDto) {
    const where: Prisma.FeedbackTicketWhereInput = {
      siteId,
      status: query.status,
      category: query.category,
      priority: query.priority,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.feedbackTicket.findMany({
        where,
        include: feedbackInclude,
        orderBy: [{ createdAt: 'desc' }],
        take: query.take ?? 50,
      }),
      this.prisma.feedbackTicket.count({ where }),
    ]);

    return {
      items: items.map((item) => mapFeedback(item)),
      total,
    };
  }

  async updateAdminFeedback(
    user: AuthenticatedUser,
    feedbackId: string,
    input: UpdateFeedbackDto,
  ) {
    const existing = await this.prisma.feedbackTicket.findFirst({
      where: {
        id: feedbackId,
        siteId: user.siteId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'FEEDBACK_NOT_FOUND',
        message: 'Feedback was not found.',
      });
    }

    if (input.assignedToUserId) {
      const assignee = await this.prisma.user.findFirst({
        where: {
          id: input.assignedToUserId,
          siteId: user.siteId,
        },
        select: {
          id: true,
        },
      });

      if (!assignee) {
        throw new NotFoundException({
          code: 'FEEDBACK_ASSIGNEE_NOT_FOUND',
          message: 'Assigned user was not found.',
        });
      }
    }

    const resolvedNow =
      input.status === FeedbackStatus.RESOLVED ||
      input.status === FeedbackStatus.CLOSED;
    const updated = await this.prisma.feedbackTicket.update({
      where: { id: feedbackId },
      data: {
        status: input.status,
        priority: input.priority,
        adminNote: input.adminNote,
        assignedToUserId: input.assignedToUserId,
        resolvedAt: resolvedNow ? new Date() : undefined,
        resolvedByUserId: resolvedNow ? user.userId : undefined,
      },
      include: feedbackInclude,
    });

    return mapFeedback(updated);
  }

  private async assertAttachments(siteId: string, fileAssetIds: string[]) {
    if (fileAssetIds.length === 0) {
      return;
    }

    const assets = await this.prisma.fileAsset.findMany({
      where: {
        id: {
          in: fileAssetIds,
        },
        siteId,
        purpose: FileAssetPurpose.FEEDBACK_ATTACHMENT,
        status: FileAssetStatus.READY,
      },
      select: {
        id: true,
      },
    });

    if (assets.length !== fileAssetIds.length) {
      throw new BadRequestException({
        code: 'FEEDBACK_ATTACHMENT_INVALID',
        message: 'One or more feedback attachments are invalid.',
      });
    }
  }
}

const feedbackInclude = {
  user: {
    select: {
      id: true,
      email: true,
    },
  },
  attachments: {
    select: {
      id: true,
      fileAssetId: true,
      label: true,
      fileAsset: {
        select: {
          id: true,
          originalFileName: true,
          contentType: true,
          status: true,
        },
      },
    },
  },
} satisfies Prisma.FeedbackTicketInclude;

type FeedbackRecord = Prisma.FeedbackTicketGetPayload<{
  include: typeof feedbackInclude;
}>;

function mapFeedback(item: FeedbackRecord) {
  return {
    id: item.id,
    category: item.category,
    status: item.status,
    priority: item.priority,
    subject: item.subject,
    message: item.message,
    pageUrl: item.pageUrl,
    pageTitle: item.pageTitle,
    adminNote: item.adminNote,
    userId: item.userId,
    userEmail: item.user?.email ?? null,
    attachments: item.attachments.map((attachment) => ({
      id: attachment.id,
      fileAssetId: attachment.fileAssetId,
      label: attachment.label,
      originalFileName: attachment.fileAsset.originalFileName,
      contentType: attachment.fileAsset.contentType,
      status: attachment.fileAsset.status,
    })),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
