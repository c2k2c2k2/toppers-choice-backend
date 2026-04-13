import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
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
import type { Response } from 'express';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  AdminEnglishSpeakingTopicDetailResponseDto,
  AdminEnglishSpeakingTopicListResponseDto,
} from './dto/english-speaking-response.dto';
import {
  FinalizeEnglishSpeakingAudioDto,
  GenerateEnglishSpeakingAudioDto,
  ListAdminEnglishSpeakingQueryDto,
  CreateEnglishSpeakingTopicDto,
  PublishEnglishSpeakingTopicDto,
  UpdateEnglishSpeakingTopicDto,
} from './dto/manage-english-speaking.dto';
import { EnglishSpeakingService } from './english-speaking.service';
import { EnglishSpeakingLanguage } from '@prisma/client';

@ApiTags('admin-english-speaking')
@ApiBearerAuth('access-token')
@Controller('admin/english-speaking')
export class AdminEnglishSpeakingController {
  constructor(
    private readonly englishSpeakingService: EnglishSpeakingService,
  ) {}

  @Get()
  @Policy('content.structured.read')
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listTopics(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminEnglishSpeakingQueryDto,
  ) {
    return this.englishSpeakingService.listAdminTopics(user.siteId, query);
  }

  @Get(':topicId')
  @Policy('content.structured.read')
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async getTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
  ) {
    return this.englishSpeakingService.getAdminTopic(user.siteId, topicId);
  }

  @Post()
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.english_speaking.topics.create',
    resourceType: 'english_speaking_topic',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['title', 'slug', 'visibility', 'accessType'],
  })
  @ApiCreatedResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateEnglishSpeakingTopicDto,
  ) {
    return this.englishSpeakingService.createTopic(user, body);
  }

  @Patch(':topicId')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.english_speaking.topics.update',
    resourceType: 'english_speaking_topic',
    resourceIdParam: 'topicId',
    includeBodyKeys: ['title', 'slug', 'visibility', 'accessType'],
  })
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async updateTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() body: UpdateEnglishSpeakingTopicDto,
  ) {
    return this.englishSpeakingService.updateTopic(user, topicId, body);
  }

  @Post(':topicId/publish')
  @Policy('content.structured.publish')
  @Audit({
    action: 'admin.english_speaking.topics.publish',
    resourceType: 'english_speaking_topic',
    resourceIdParam: 'topicId',
    includeBodyKeys: ['publishAt'],
  })
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async publishTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() body: PublishEnglishSpeakingTopicDto,
  ) {
    return this.englishSpeakingService.publishTopic(user, topicId, body);
  }

  @Post(':topicId/unpublish')
  @Policy('content.structured.publish')
  @Audit({
    action: 'admin.english_speaking.topics.unpublish',
    resourceType: 'english_speaking_topic',
    resourceIdParam: 'topicId',
  })
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async unpublishTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
  ) {
    return this.englishSpeakingService.unpublishTopic(user, topicId);
  }

  @Delete(':topicId')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.english_speaking.topics.delete',
    resourceType: 'english_speaking_topic',
    resourceIdParam: 'topicId',
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async deleteTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
  ) {
    return this.englishSpeakingService.deleteTopic(user, topicId);
  }

  @Post(':topicId/generate-audio')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.english_speaking.topics.generate_audio',
    resourceType: 'english_speaking_topic',
    resourceIdParam: 'topicId',
    includeBodyKeys: ['languages'],
  })
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async generateTopicAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() body: GenerateEnglishSpeakingAudioDto,
  ) {
    return this.englishSpeakingService.generateTopicAudio(user, topicId, body);
  }

  @Post(':topicId/finalize-audio')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.english_speaking.topics.finalize_audio',
    resourceType: 'english_speaking_topic',
    resourceIdParam: 'topicId',
    includeBodyKeys: ['languages'],
  })
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async finalizeTopicAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() body: FinalizeEnglishSpeakingAudioDto,
  ) {
    return this.englishSpeakingService.finalizeTopicAudio(user, topicId, body);
  }

  @Post('sentences/:sentenceId/generate-audio')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.english_speaking.sentences.generate_audio',
    resourceType: 'english_speaking_sentence',
    resourceIdParam: 'sentenceId',
    includeBodyKeys: ['languages'],
  })
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async generateSentenceAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sentenceId') sentenceId: string,
    @Body() body: GenerateEnglishSpeakingAudioDto,
  ) {
    return this.englishSpeakingService.generateSentenceAudio(
      user,
      sentenceId,
      body,
    );
  }

  @Post('sentences/:sentenceId/finalize-audio')
  @Policy('content.structured.manage')
  @Audit({
    action: 'admin.english_speaking.sentences.finalize_audio',
    resourceType: 'english_speaking_sentence',
    resourceIdParam: 'sentenceId',
    includeBodyKeys: ['languages'],
  })
  @ApiOkResponse({ type: AdminEnglishSpeakingTopicDetailResponseDto })
  async finalizeSentenceAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sentenceId') sentenceId: string,
    @Body() body: FinalizeEnglishSpeakingAudioDto,
  ) {
    return this.englishSpeakingService.finalizeSentenceAudio(
      user,
      sentenceId,
      body,
    );
  }

  @Get('sentences/:sentenceId/audio/:language/preview')
  @Policy('content.structured.read')
  @ApiOkResponse({
    description: 'Streams the latest admin preview audio for a sentence.',
  })
  async streamPreviewAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sentenceId') sentenceId: string,
    @Param('language') language: EnglishSpeakingLanguage,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.englishSpeakingService.streamAdminAudio(
      user.siteId,
      sentenceId,
      language,
      'preview',
      response,
    );
  }

  @Get('sentences/:sentenceId/audio/:language/final')
  @Policy('content.structured.read')
  @ApiOkResponse({
    description: 'Streams the finalized audio currently linked to a sentence.',
  })
  async streamFinalAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sentenceId') sentenceId: string,
    @Param('language') language: EnglishSpeakingLanguage,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.englishSpeakingService.streamAdminAudio(
      user.siteId,
      sentenceId,
      language,
      'finalized',
      response,
    );
  }
}
