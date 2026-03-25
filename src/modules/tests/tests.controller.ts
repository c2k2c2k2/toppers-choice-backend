import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  ListPublishedTestsQueryDto,
  ListTestAttemptsQueryDto,
  SaveTestAttemptAnswerDto,
} from './dto/manage-tests.dto';
import {
  SaveTestAttemptAnswerResponseDto,
  StudentTestDetailResponseDto,
  TestAttemptDetailResponseDto,
  TestAttemptsListResponseDto,
  TestsListResponseDto,
} from './dto/test-response.dto';
import { TestsService } from './tests.service';

@ApiTags('tests')
@ApiBearerAuth('access-token')
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  @ApiOkResponse({ type: TestsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listTests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPublishedTestsQueryDto,
  ) {
    return this.testsService.listPublishedTests(user, query);
  }

  @Post(':testId/attempts')
  @ApiCreatedResponse({ type: TestAttemptDetailResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async startAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('testId') testId: string,
  ) {
    return this.testsService.startAttempt(user, testId);
  }

  @Get('attempts/history')
  @ApiOkResponse({ type: TestAttemptsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listAttempts(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTestAttemptsQueryDto,
  ) {
    return this.testsService.listAttempts(user, query);
  }

  @Get('attempts/:attemptId')
  @ApiOkResponse({ type: TestAttemptDetailResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
  ) {
    return this.testsService.getAttempt(user, attemptId);
  }

  @Post('attempts/:attemptId/save')
  @ApiOkResponse({ type: SaveTestAttemptAnswerResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async saveAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
    @Body() body: SaveTestAttemptAnswerDto,
  ) {
    return this.testsService.saveAttemptAnswer(user, attemptId, body);
  }

  @Post('attempts/:attemptId/submit')
  @ApiOkResponse({ type: TestAttemptDetailResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async submitAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
  ) {
    return this.testsService.submitAttempt(user, attemptId);
  }

  @Get(':testId')
  @ApiOkResponse({ type: StudentTestDetailResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getTest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('testId') testId: string,
  ) {
    return this.testsService.getPublishedTest(user, testId);
  }
}
