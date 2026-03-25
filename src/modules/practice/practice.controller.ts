import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  EndPracticeSessionDto,
  GetNextPracticeQuestionsQueryDto,
  ListPracticeSessionsQueryDto,
  ListPracticeTrendsQueryDto,
  ListSubjectPracticeProgressQueryDto,
  ListTopicPracticeProgressQueryDto,
  ListWeakPracticeQuestionsQueryDto,
  RevealPracticeQuestionDto,
  SavePracticeAnswerDto,
  StartPracticeSessionDto,
  SubmitPracticeAnswerDto,
} from './dto/manage-practice.dto';
import {
  PracticeAnswerResultResponseDto,
  PracticeQuestionBatchResponseDto,
  PracticeRevealResultResponseDto,
  PracticeSaveResultResponseDto,
  PracticeSessionDetailResponseDto,
  PracticeSessionSummaryResponseDto,
  PracticeSessionsListResponseDto,
  PracticeSubjectProgressListResponseDto,
  PracticeTopicProgressListResponseDto,
  PracticeTrendsResponseDto,
  PracticeWeakQuestionsResponseDto,
} from './dto/practice-response.dto';
import { PracticeService } from './practice.service';

@ApiTags('practice')
@ApiBearerAuth('access-token')
@Controller('practice')
export class PracticeController {
  constructor(private readonly practiceService: PracticeService) {}

  @Post('sessions')
  @ApiCreatedResponse({ type: PracticeSessionSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async startSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StartPracticeSessionDto,
  ) {
    return this.practiceService.startSession(user, body);
  }

  @Get('sessions')
  @ApiOkResponse({ type: PracticeSessionsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPracticeSessionsQueryDto,
  ) {
    return this.practiceService.listSessions(user, query);
  }

  @Get('sessions/:sessionId')
  @ApiOkResponse({ type: PracticeSessionDetailResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.practiceService.getSession(user, sessionId);
  }

  @Get('sessions/:sessionId/next')
  @ApiOkResponse({ type: PracticeQuestionBatchResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getNextQuestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Query() query: GetNextPracticeQuestionsQueryDto,
  ) {
    return this.practiceService.getNextQuestions(user, sessionId, query);
  }

  @Post('sessions/:sessionId/save')
  @ApiOkResponse({ type: PracticeSaveResultResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async saveAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: SavePracticeAnswerDto,
  ) {
    return this.practiceService.saveAnswer(user, sessionId, body);
  }

  @Post('sessions/:sessionId/answer')
  @ApiOkResponse({ type: PracticeAnswerResultResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async submitAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: SubmitPracticeAnswerDto,
  ) {
    return this.practiceService.submitAnswer(user, sessionId, body);
  }

  @Post('sessions/:sessionId/reveal')
  @ApiOkResponse({ type: PracticeRevealResultResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async revealAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: RevealPracticeQuestionDto,
  ) {
    return this.practiceService.revealAnswer(user, sessionId, body);
  }

  @Post('sessions/:sessionId/end')
  @ApiOkResponse({ type: PracticeSessionSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async endSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
    @Body() body: EndPracticeSessionDto,
  ) {
    return this.practiceService.endSession(user, sessionId, body);
  }

  @Get('progress/subjects')
  @ApiOkResponse({ type: PracticeSubjectProgressListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listSubjectProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSubjectPracticeProgressQueryDto,
  ) {
    return this.practiceService.listSubjectProgress(user, query);
  }

  @Get('progress/topics')
  @ApiOkResponse({ type: PracticeTopicProgressListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listTopicProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTopicPracticeProgressQueryDto,
  ) {
    return this.practiceService.listTopicProgress(user, query);
  }

  @Get('progress/weak-questions')
  @ApiOkResponse({ type: PracticeWeakQuestionsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listWeakQuestions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWeakPracticeQuestionsQueryDto,
  ) {
    return this.practiceService.listWeakQuestions(user, query);
  }

  @Get('progress/trends')
  @ApiOkResponse({ type: PracticeTrendsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getTrends(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPracticeTrendsQueryDto,
  ) {
    return this.practiceService.getTrends(user, query);
  }
}
