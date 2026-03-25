import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

type CreateAuditLogInput = {
  siteId: string;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  meta?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createAuditLog(input: CreateAuditLogInput) {
    await this.prisma.auditLog.create({
      data: {
        siteId: input.siteId,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metaJson: input.meta
          ? (input.meta as Prisma.InputJsonObject)
          : Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async listAuditLogs(siteId: string, query: ListAuditLogsQueryDto) {
    return this.prisma.auditLog.findMany({
      where: {
        siteId,
        action: query.action,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        actorUserId: query.actorUserId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: query.limit ?? 25,
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
  }
}
