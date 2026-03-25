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
  CreateTestDto,
  ListAdminTestsQueryDto,
  UpdateTestDto,
} from './dto/manage-tests.dto';
import {
  AdminTestDetailResponseDto,
  TestsListResponseDto,
} from './dto/test-response.dto';
import { TestsService } from './tests.service';

@ApiTags('admin-tests')
@ApiBearerAuth('access-token')
@Controller('admin/tests')
export class AdminTestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  @Policy('academics.tests.read')
  @ApiOkResponse({ type: TestsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listTests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminTestsQueryDto,
  ) {
    return this.testsService.listAdminTests(user.siteId, query);
  }

  @Get(':testId')
  @Policy('academics.tests.read')
  @ApiOkResponse({ type: AdminTestDetailResponseDto })
  async getTest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('testId') testId: string,
  ) {
    return this.testsService.getAdminTest(user.siteId, testId);
  }

  @Post()
  @Policy('academics.tests.manage')
  @Audit({
    action: 'admin.tests.create',
    resourceType: 'test',
    resourceIdResponseField: 'id',
    includeBodyKeys: [
      'code',
      'slug',
      'title',
      'family',
      'examTrackId',
      'mediumId',
      'subjectId',
      'durationMinutes',
      'maxAttempts',
    ],
  })
  @ApiCreatedResponse({ type: AdminTestDetailResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createTest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTestDto,
  ) {
    return this.testsService.createTest(user, body);
  }

  @Patch(':testId')
  @Policy('academics.tests.manage')
  @Audit({
    action: 'admin.tests.update',
    resourceType: 'test',
    resourceIdParam: 'testId',
    includeBodyKeys: [
      'code',
      'slug',
      'title',
      'family',
      'examTrackId',
      'mediumId',
      'subjectId',
      'durationMinutes',
      'maxAttempts',
    ],
  })
  @ApiOkResponse({ type: AdminTestDetailResponseDto })
  async updateTest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('testId') testId: string,
    @Body() body: UpdateTestDto,
  ) {
    return this.testsService.updateTest(user, testId, body);
  }

  @Post(':testId/publish')
  @Policy('academics.tests.publish')
  @Audit({
    action: 'admin.tests.publish',
    resourceType: 'test',
    resourceIdParam: 'testId',
  })
  @ApiOkResponse({ type: AdminTestDetailResponseDto })
  async publishTest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('testId') testId: string,
  ) {
    return this.testsService.publishTest(user, testId);
  }

  @Post(':testId/unpublish')
  @Policy('academics.tests.publish')
  @Audit({
    action: 'admin.tests.unpublish',
    resourceType: 'test',
    resourceIdParam: 'testId',
  })
  @ApiOkResponse({ type: AdminTestDetailResponseDto })
  async unpublishTest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('testId') testId: string,
  ) {
    return this.testsService.unpublishTest(user, testId);
  }
}
