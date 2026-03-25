import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateExamTrackDto,
  CreateMediumDto,
  CreateSubjectDto,
  CreateTagDto,
  CreateTopicDto,
  ListSubjectsQueryDto,
  ListTopicsQueryDto,
  ReorderTaxonomyDto,
  UpdateExamTrackDto,
  UpdateMediumDto,
  UpdateSubjectDto,
  UpdateTagDto,
  UpdateTopicDto,
} from './dto/manage-taxonomy.dto';
import {
  ExamTrackResponseDto,
  MediumResponseDto,
  SubjectResponseDto,
  TagResponseDto,
  TopicResponseDto,
} from './dto/taxonomy-response.dto';
import {
  mapExamTrack,
  mapMedium,
  mapSubject,
  mapTag,
  mapTopic,
} from './taxonomy.types';
import { TaxonomyService } from './taxonomy.service';

@ApiTags('admin-taxonomy')
@ApiBearerAuth('access-token')
@Controller('admin/taxonomy')
export class AdminTaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('exam-tracks')
  @Policy('academics.taxonomy.read')
  @ApiOkResponse({ type: [ExamTrackResponseDto] })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listExamTracks(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.taxonomyService.listExamTracks(user.siteId);
    return items.map((item) => mapExamTrack(item));
  }

  @Post('exam-tracks')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.exam_tracks.create',
    resourceType: 'exam_track',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['name', 'code', 'slug'],
  })
  @ApiCreatedResponse({ type: ExamTrackResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createExamTrack(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateExamTrackDto,
  ) {
    return this.taxonomyService.createExamTrack(user.siteId, body);
  }

  @Patch('exam-tracks/:examTrackId')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.exam_tracks.update',
    resourceType: 'exam_track',
    resourceIdParam: 'examTrackId',
    includeBodyKeys: ['name', 'code', 'slug', 'visibility', 'isActive'],
  })
  @ApiOkResponse({ type: ExamTrackResponseDto })
  async updateExamTrack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('examTrackId') examTrackId: string,
    @Body() body: UpdateExamTrackDto,
  ) {
    return this.taxonomyService.updateExamTrack(user.siteId, examTrackId, body);
  }

  @Put('exam-tracks/reorder')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.exam_tracks.reorder',
    resourceType: 'exam_track',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderExamTracks(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderTaxonomyDto,
  ) {
    await this.taxonomyService.reorderExamTracks(user.siteId, body);

    return {
      message: 'Exam tracks reordered successfully.',
    };
  }

  @Get('mediums')
  @Policy('academics.taxonomy.read')
  @ApiOkResponse({ type: [MediumResponseDto] })
  async listMediums(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.taxonomyService.listMediums(user.siteId);
    return items.map((item) => mapMedium(item));
  }

  @Post('mediums')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.mediums.create',
    resourceType: 'medium',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['name', 'code', 'slug'],
  })
  @ApiCreatedResponse({ type: MediumResponseDto })
  async createMedium(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateMediumDto,
  ) {
    return this.taxonomyService.createMedium(user.siteId, body);
  }

  @Patch('mediums/:mediumId')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.mediums.update',
    resourceType: 'medium',
    resourceIdParam: 'mediumId',
    includeBodyKeys: ['name', 'code', 'slug', 'visibility', 'isActive'],
  })
  @ApiOkResponse({ type: MediumResponseDto })
  async updateMedium(
    @CurrentUser() user: AuthenticatedUser,
    @Param('mediumId') mediumId: string,
    @Body() body: UpdateMediumDto,
  ) {
    return this.taxonomyService.updateMedium(user.siteId, mediumId, body);
  }

  @Put('mediums/reorder')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.mediums.reorder',
    resourceType: 'medium',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderMediums(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderTaxonomyDto,
  ) {
    await this.taxonomyService.reorderMediums(user.siteId, body);

    return {
      message: 'Mediums reordered successfully.',
    };
  }

  @Get('subjects')
  @Policy('academics.taxonomy.read')
  @ApiOkResponse({ type: [SubjectResponseDto] })
  async listSubjects(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSubjectsQueryDto,
  ) {
    const items = await this.taxonomyService.listSubjects(
      user.siteId,
      query.examTrackId,
    );
    return items.map((item) => mapSubject(item));
  }

  @Post('subjects')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.subjects.create',
    resourceType: 'subject',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['name', 'code', 'slug', 'examTrackId'],
  })
  @ApiCreatedResponse({ type: SubjectResponseDto })
  async createSubject(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSubjectDto,
  ) {
    return this.taxonomyService.createSubject(user.siteId, body);
  }

  @Patch('subjects/:subjectId')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.subjects.update',
    resourceType: 'subject',
    resourceIdParam: 'subjectId',
    includeBodyKeys: [
      'name',
      'code',
      'slug',
      'examTrackId',
      'visibility',
      'isActive',
    ],
  })
  @ApiOkResponse({ type: SubjectResponseDto })
  async updateSubject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('subjectId') subjectId: string,
    @Body() body: UpdateSubjectDto,
  ) {
    return this.taxonomyService.updateSubject(user.siteId, subjectId, body);
  }

  @Put('subjects/reorder')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.subjects.reorder',
    resourceType: 'subject',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderSubjects(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderTaxonomyDto,
  ) {
    await this.taxonomyService.reorderSubjects(user.siteId, body);

    return {
      message: 'Subjects reordered successfully.',
    };
  }

  @Get('topics')
  @Policy('academics.taxonomy.read')
  @ApiOkResponse({ type: [TopicResponseDto] })
  async listTopics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTopicsQueryDto,
  ) {
    const items = await this.taxonomyService.listTopics(
      user.siteId,
      query.subjectId,
    );
    return items.map((item) => mapTopic(item));
  }

  @Post('topics')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.topics.create',
    resourceType: 'topic',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['name', 'code', 'slug', 'subjectId', 'parentId'],
  })
  @ApiCreatedResponse({ type: TopicResponseDto })
  async createTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTopicDto,
  ) {
    return this.taxonomyService.createTopic(user.siteId, body);
  }

  @Patch('topics/:topicId')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.topics.update',
    resourceType: 'topic',
    resourceIdParam: 'topicId',
    includeBodyKeys: [
      'name',
      'code',
      'slug',
      'subjectId',
      'parentId',
      'visibility',
      'isActive',
    ],
  })
  @ApiOkResponse({ type: TopicResponseDto })
  async updateTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() body: UpdateTopicDto,
  ) {
    return this.taxonomyService.updateTopic(user.siteId, topicId, body);
  }

  @Put('topics/reorder')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.topics.reorder',
    resourceType: 'topic',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderTopics(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderTaxonomyDto,
  ) {
    await this.taxonomyService.reorderTopics(user.siteId, body);

    return {
      message: 'Topics reordered successfully.',
    };
  }

  @Get('tags')
  @Policy('academics.taxonomy.read')
  @ApiOkResponse({ type: [TagResponseDto] })
  async listTags(@CurrentUser() user: AuthenticatedUser) {
    const items = await this.taxonomyService.listTags(user.siteId);
    return items.map((item) => mapTag(item));
  }

  @Post('tags')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.tags.create',
    resourceType: 'tag',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['name', 'code', 'slug'],
  })
  @ApiCreatedResponse({ type: TagResponseDto })
  async createTag(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTagDto,
  ) {
    return this.taxonomyService.createTag(user.siteId, body);
  }

  @Patch('tags/:tagId')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.tags.update',
    resourceType: 'tag',
    resourceIdParam: 'tagId',
    includeBodyKeys: ['name', 'code', 'slug', 'visibility', 'isActive'],
  })
  @ApiOkResponse({ type: TagResponseDto })
  async updateTag(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tagId') tagId: string,
    @Body() body: UpdateTagDto,
  ) {
    return this.taxonomyService.updateTag(user.siteId, tagId, body);
  }

  @Put('tags/reorder')
  @Policy('academics.taxonomy.manage')
  @Audit({
    action: 'admin.taxonomy.tags.reorder',
    resourceType: 'tag',
    includeBodyKeys: ['orderedIds'],
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async reorderTags(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReorderTaxonomyDto,
  ) {
    await this.taxonomyService.reorderTags(user.siteId, body);

    return {
      message: 'Tags reordered successfully.',
    };
  }
}
