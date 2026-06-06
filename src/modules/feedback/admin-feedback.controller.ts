import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import {
  FeedbackListResponseDto,
  FeedbackResponseDto,
} from './dto/feedback-response.dto';
import {
  ListFeedbackQueryDto,
  UpdateFeedbackDto,
} from './dto/manage-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('admin-feedback')
@ApiBearerAuth('access-token')
@Controller('admin/feedback')
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  @Policy('feedback.read')
  @ApiOkResponse({ type: FeedbackListResponseDto })
  async listFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFeedbackQueryDto,
  ) {
    return this.feedbackService.listAdminFeedback(user.siteId, query);
  }

  @Patch(':feedbackId')
  @Policy('feedback.manage')
  @Audit({
    action: 'admin.feedback.update',
    resourceType: 'feedback_ticket',
    resourceIdParam: 'feedbackId',
    includeBodyKeys: ['status', 'priority', 'assignedToUserId'],
  })
  @ApiOkResponse({ type: FeedbackResponseDto })
  async updateFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('feedbackId') feedbackId: string,
    @Body() body: UpdateFeedbackDto,
  ) {
    return this.feedbackService.updateAdminFeedback(user, feedbackId, body);
  }
}
