import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { AdminOpsService } from './admin-ops.service';
import { ListNoteSecuritySignalsQueryDto } from './dto/admin-ops.dto';
import {
  AdminContentHealthResponseDto,
  AdminOpsDashboardResponseDto,
  NoteSecuritySignalsListResponseDto,
} from './dto/admin-ops-response.dto';

@ApiTags('admin-ops')
@ApiBearerAuth('access-token')
@Controller('admin/ops')
export class AdminOpsController {
  constructor(private readonly adminOpsService: AdminOpsService) {}

  @Get('dashboard')
  @Policy('admin.ops.read')
  @ApiOkResponse({ type: AdminOpsDashboardResponseDto })
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.adminOpsService.getDashboard(user.siteId);
  }

  @Get('content-health')
  @Policy('admin.ops.read')
  @ApiOkResponse({ type: AdminContentHealthResponseDto })
  async getContentHealth(@CurrentUser() user: AuthenticatedUser) {
    return this.adminOpsService.getContentHealth(user.siteId);
  }

  @Get('note-security-signals')
  @Policy('admin.security.read')
  @ApiOkResponse({ type: NoteSecuritySignalsListResponseDto })
  async listNoteSecuritySignals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListNoteSecuritySignalsQueryDto,
  ) {
    return this.adminOpsService.listNoteSecuritySignals(user.siteId, query);
  }

  @Get('exports/users')
  @Policy('admin.ops.export')
  @ApiProduces('text/csv')
  async exportUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="users-export.csv"',
    );
    return this.adminOpsService.exportUsersCsv(user.siteId);
  }

  @Get('exports/subscriptions')
  @Policy('admin.ops.export')
  @ApiProduces('text/csv')
  async exportSubscriptions(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="subscriptions-export.csv"',
    );
    return this.adminOpsService.exportSubscriptionsCsv(user.siteId);
  }

  @Get('exports/payments')
  @Policy('admin.ops.export')
  @ApiProduces('text/csv')
  async exportPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="payments-export.csv"',
    );
    return this.adminOpsService.exportPaymentsCsv(user.siteId);
  }

  @Post('users/:userId/revoke-sessions')
  @Policy('admin.ops.support')
  @Audit({
    action: 'admin.ops.users.revoke_sessions',
    resourceType: 'user',
    resourceIdParam: 'userId',
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async revokeUserSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.adminOpsService.revokeUserSessions(user.siteId, userId);
  }

  @Post('note-view-sessions/:noteViewSessionId/revoke')
  @Policy('admin.ops.support')
  @Audit({
    action: 'admin.ops.note_view_sessions.revoke',
    resourceType: 'note_view_session',
    resourceIdParam: 'noteViewSessionId',
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async revokeNoteViewSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteViewSessionId') noteViewSessionId: string,
  ) {
    return this.adminOpsService.revokeNoteViewSession(
      user.siteId,
      noteViewSessionId,
      user.userId,
    );
  }
}
