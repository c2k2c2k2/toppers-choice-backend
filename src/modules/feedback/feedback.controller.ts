import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { getRequestSessionMetadata } from '../auth/auth.utils';
import {
  FeedbackListResponseDto,
  FeedbackResponseDto,
} from './dto/feedback-response.dto';
import {
  CreateFeedbackDto,
  ListFeedbackQueryDto,
} from './dto/manage-feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth('access-token')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @ApiCreatedResponse({ type: FeedbackResponseDto })
  async createFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateFeedbackDto,
    @Req() request: Request,
  ) {
    return this.feedbackService.createFeedback(
      user,
      body,
      getRequestSessionMetadata(request),
    );
  }

  @Get('me')
  @ApiOkResponse({ type: FeedbackListResponseDto })
  async listMyFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFeedbackQueryDto,
  ) {
    return this.feedbackService.listMyFeedback(user, query);
  }
}
