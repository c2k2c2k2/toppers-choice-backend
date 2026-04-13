import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  StudentEnglishSpeakingTopicDetailResponseDto,
  StudentEnglishSpeakingTopicListResponseDto,
} from './dto/english-speaking-response.dto';
import { EnglishSpeakingService } from './english-speaking.service';
import { EnglishSpeakingLanguage } from '@prisma/client';

@ApiTags('english-speaking')
@ApiBearerAuth('access-token')
@Controller('english-speaking')
export class EnglishSpeakingController {
  constructor(
    private readonly englishSpeakingService: EnglishSpeakingService,
  ) {}

  @Get()
  @ApiOkResponse({ type: StudentEnglishSpeakingTopicListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listTopics(@CurrentUser() user: AuthenticatedUser) {
    return this.englishSpeakingService.listStudentTopics(user);
  }

  @Get('sentences/:sentenceId/audio/:language')
  @ApiOkResponse({
    description:
      'Streams the finalized English-speaking audio for the student route.',
  })
  async streamSentenceAudio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sentenceId') sentenceId: string,
    @Param('language') language: EnglishSpeakingLanguage,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    return this.englishSpeakingService.streamStudentAudio(
      user,
      sentenceId,
      language,
      response,
    );
  }

  @Get(':slug')
  @ApiOkResponse({ type: StudentEnglishSpeakingTopicDetailResponseDto })
  async getTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.englishSpeakingService.getStudentTopic(user, slug);
  }
}
