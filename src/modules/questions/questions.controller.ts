import { Controller, Get, Param, Query } from '@nestjs/common';
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
import { ListQuestionsQueryDto } from './dto/manage-questions.dto';
import {
  QuestionsListResponseDto,
  StudentQuestionDetailResponseDto,
} from './dto/question-response.dto';
import { QuestionsService } from './questions.service';

@ApiTags('questions')
@ApiBearerAuth('access-token')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @ApiOkResponse({ type: QuestionsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listQuestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQuestionsQueryDto,
  ) {
    return this.questionsService.listPublishedQuestions(user, query);
  }

  @Get(':questionId')
  @ApiOkResponse({ type: StudentQuestionDetailResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('questionId') questionId: string,
  ) {
    return this.questionsService.getPublishedQuestion(user, questionId);
  }
}
