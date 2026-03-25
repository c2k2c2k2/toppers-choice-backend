import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Policy } from './decorators/policy.decorator';
import { AuditService } from './audit.service';
import { AuditLogsListResponseDto } from './dto/audit-log-response.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@ApiTags('admin-audit')
@ApiBearerAuth('access-token')
@Controller('admin/audit-logs')
export class AdminAuditLogsController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Policy('admin.audit.read')
  @ApiOkResponse({ type: AuditLogsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listAuditLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAuditLogsQueryDto,
  ) {
    const logs = await this.auditService.listAuditLogs(user.siteId, query);

    return {
      items: logs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        actor: log.actorUser
          ? {
              id: log.actorUser.id,
              email: log.actorUser.email,
              fullName: log.actorUser.fullName,
            }
          : null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        meta:
          log.metaJson && typeof log.metaJson === 'object' && !Array.isArray(log.metaJson)
            ? (log.metaJson as Record<string, unknown>)
            : null,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}
