import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateQuestionDto,
  ListAdminQuestionsQueryDto,
  UpdateQuestionDto,
} from './dto/manage-questions.dto';
import {
  AdminQuestionDetailResponseDto,
  QuestionsListResponseDto,
} from './dto/question-response.dto';
import { QuestionsService } from './questions.service';

@ApiTags('admin-questions')
@ApiBearerAuth('access-token')
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @Policy('academics.questions.read')
  @ApiOkResponse({ type: QuestionsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listQuestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminQuestionsQueryDto,
  ) {
    return this.questionsService.listAdminQuestions(user.siteId, query);
  }

  @Get(':questionId')
  @Policy('academics.questions.read')
  @ApiOkResponse({ type: AdminQuestionDetailResponseDto })
  async getQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
  ) {
    return this.questionsService.getAdminQuestion(user.siteId, questionId);
  }

  @Post()
  @Policy('academics.questions.manage')
  @Audit({
    action: 'admin.questions.create',
    resourceType: 'question',
    resourceIdResponseField: 'id',
    includeBodyKeys: [
      'code',
      'subjectId',
      'topicId',
      'mediumId',
      'type',
      'difficulty',
    ],
  })
  @ApiCreatedResponse({ type: AdminQuestionDetailResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateQuestionDto,
  ) {
    return this.questionsService.createQuestion(user, body);
  }

  @Patch(':questionId')
  @Policy('academics.questions.manage')
  @Audit({
    action: 'admin.questions.update',
    resourceType: 'question',
    resourceIdParam: 'questionId',
    includeBodyKeys: [
      'code',
      'subjectId',
      'topicId',
      'mediumId',
      'type',
      'difficulty',
    ],
  })
  @ApiOkResponse({ type: AdminQuestionDetailResponseDto })
  async updateQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
    @Body() body: UpdateQuestionDto,
  ) {
    return this.questionsService.updateQuestion(user, questionId, body);
  }

  @Post(':questionId/publish')
  @Policy('academics.questions.publish')
  @Audit({
    action: 'admin.questions.publish',
    resourceType: 'question',
    resourceIdParam: 'questionId',
  })
  @ApiOkResponse({ type: AdminQuestionDetailResponseDto })
  async publishQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
  ) {
    return this.questionsService.publishQuestion(user, questionId);
  }

  @Post(':questionId/unpublish')
  @Policy('academics.questions.publish')
  @Audit({
    action: 'admin.questions.unpublish',
    resourceType: 'question',
    resourceIdParam: 'questionId',
  })
  @ApiOkResponse({ type: AdminQuestionDetailResponseDto })
  async unpublishQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
  ) {
    return this.questionsService.unpublishQuestion(user, questionId);
  }
}
