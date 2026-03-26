import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';
import {
  ListMyNotificationsQueryDto,
  UpdateNotificationPreferencesDto,
} from './dto/manage-notifications.dto';
import {
  NotificationFeedResponseDto,
  NotificationMessageResponseDto,
  NotificationPreferenceResponseDto,
} from './dto/notification-response.dto';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  @ApiOkResponse({ type: NotificationFeedResponseDto })
  async listMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyNotificationsQueryDto,
  ) {
    return this.notificationsService.listMyNotifications(user, query);
  }

  @Post(':messageId/read')
  @ApiOkResponse({ type: NotificationMessageResponseDto })
  async markMessageRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('messageId') messageId: string,
  ) {
    return this.notificationsService.markMessageRead(user, messageId);
  }

  @Post('read-all')
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Get('preferences')
  @ApiOkResponse({ type: [NotificationPreferenceResponseDto] })
  async getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getPreferences(user);
  }

  @Post('preferences')
  @ApiOkResponse({ type: [NotificationPreferenceResponseDto] })
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user, body);
  }
}
