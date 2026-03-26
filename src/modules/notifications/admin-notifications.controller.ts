import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import {
  CreateNotificationBroadcastDto,
  CreateNotificationTemplateDto,
  ListAdminNotificationBroadcastsQueryDto,
  ListAdminNotificationMessagesQueryDto,
  ListAdminNotificationTemplatesQueryDto,
  UpdateNotificationBroadcastDto,
  UpdateNotificationTemplateDto,
} from './dto/manage-notifications.dto';
import {
  NotificationBroadcastResponseDto,
  NotificationBroadcastsListResponseDto,
  NotificationMessageResponseDto,
  NotificationMessagesListResponseDto,
  NotificationTemplateResponseDto,
  NotificationTemplatesListResponseDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('admin-notifications')
@ApiBearerAuth('access-token')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('templates')
  @Policy('notifications.read')
  @ApiOkResponse({ type: NotificationTemplatesListResponseDto })
  async listTemplates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminNotificationTemplatesQueryDto,
  ) {
    return this.notificationsService.listTemplates(user.siteId, query);
  }

  @Post('templates')
  @Policy('notifications.manage')
  @Audit({
    action: 'admin.notifications.templates.create',
    resourceType: 'notification_template',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['key', 'name', 'channel', 'status'],
  })
  @ApiCreatedResponse({ type: NotificationTemplateResponseDto })
  async createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateNotificationTemplateDto,
  ) {
    return this.notificationsService.createTemplate(user, body);
  }

  @Patch('templates/:templateId')
  @Policy('notifications.manage')
  @Audit({
    action: 'admin.notifications.templates.update',
    resourceType: 'notification_template',
    resourceIdParam: 'templateId',
    includeBodyKeys: ['key', 'name', 'channel', 'status'],
  })
  @ApiOkResponse({ type: NotificationTemplateResponseDto })
  async updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @Body() body: UpdateNotificationTemplateDto,
  ) {
    return this.notificationsService.updateTemplate(user, templateId, body);
  }

  @Get('broadcasts')
  @Policy('notifications.read')
  @ApiOkResponse({ type: NotificationBroadcastsListResponseDto })
  async listBroadcasts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminNotificationBroadcastsQueryDto,
  ) {
    return this.notificationsService.listBroadcasts(user.siteId, query);
  }

  @Get('broadcasts/:broadcastId')
  @Policy('notifications.read')
  @ApiOkResponse({ type: NotificationBroadcastResponseDto })
  async getBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId') broadcastId: string,
  ) {
    return this.notificationsService.getBroadcast(user.siteId, broadcastId);
  }

  @Post('broadcasts')
  @Policy('notifications.manage')
  @Audit({
    action: 'admin.notifications.broadcasts.create',
    resourceType: 'notification_broadcast',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['audienceType', 'channel', 'title'],
  })
  @ApiCreatedResponse({ type: NotificationBroadcastResponseDto })
  async createBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateNotificationBroadcastDto,
  ) {
    return this.notificationsService.createBroadcast(user, body);
  }

  @Patch('broadcasts/:broadcastId')
  @Policy('notifications.manage')
  @Audit({
    action: 'admin.notifications.broadcasts.update',
    resourceType: 'notification_broadcast',
    resourceIdParam: 'broadcastId',
    includeBodyKeys: ['audienceType', 'channel', 'title'],
  })
  @ApiOkResponse({ type: NotificationBroadcastResponseDto })
  async updateBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId') broadcastId: string,
    @Body() body: UpdateNotificationBroadcastDto,
  ) {
    return this.notificationsService.updateBroadcast(user, broadcastId, body);
  }

  @Post('broadcasts/:broadcastId/dispatch')
  @Policy('notifications.send')
  @ApiHeader({
    name: 'x-idempotency-key',
    required: false,
    description: 'Recommended for dispatch retries to prevent duplicate sends.',
  })
  @Audit({
    action: 'admin.notifications.broadcasts.dispatch',
    resourceType: 'notification_broadcast',
    resourceIdParam: 'broadcastId',
  })
  @ApiOkResponse({ type: NotificationBroadcastResponseDto })
  async dispatchBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId') broadcastId: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.notificationsService.dispatchBroadcast(
      user,
      broadcastId,
      idempotencyKey,
    );
  }

  @Post('broadcasts/:broadcastId/cancel')
  @Policy('notifications.send')
  @Audit({
    action: 'admin.notifications.broadcasts.cancel',
    resourceType: 'notification_broadcast',
    resourceIdParam: 'broadcastId',
  })
  @ApiOkResponse({ type: NotificationBroadcastResponseDto })
  async cancelBroadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Param('broadcastId') broadcastId: string,
  ) {
    return this.notificationsService.cancelBroadcast(user, broadcastId);
  }

  @Get('messages')
  @Policy('notifications.read')
  @ApiOkResponse({ type: NotificationMessagesListResponseDto })
  async listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminNotificationMessagesQueryDto,
  ) {
    return this.notificationsService.listMessages(user.siteId, query);
  }
}
