import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { Public } from '../auth/decorators/public.decorator';
import { getRequestSessionMetadata } from '../auth/auth.utils';
import { NoteWatermarkResponseDto } from './dto/note-response.dto';
import { NotesService } from './notes.service';

@ApiTags('note-view-sessions')
@Controller('notes/view-sessions')
export class NoteViewSessionsController {
  constructor(private readonly notesService: NotesService) {}

  @Public()
  @Get(':noteViewSessionId/watermark')
  @ApiBearerAuth('note-view-token')
  @ApiOkResponse({ type: NoteWatermarkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getWatermark(
    @Param('noteViewSessionId') noteViewSessionId: string,
    @Req() request: Request,
  ) {
    const session = await this.notesService.resolveViewSessionFromToken(
      this.extractNoteViewToken(request),
      getRequestSessionMetadata(request),
    );

    this.assertViewSessionPathMatches(
      noteViewSessionId,
      session.noteViewSession.id,
    );

    return this.notesService.getWatermarkPayload(
      session,
      getRequestSessionMetadata(request),
    );
  }

  @Public()
  @Get(':noteViewSessionId/content')
  @ApiBearerAuth('note-view-token')
  @ApiOkResponse({
    description: 'Streams note PDF content for a valid view session token.',
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async streamContent(
    @Param('noteViewSessionId') noteViewSessionId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const session = await this.notesService.resolveViewSessionFromToken(
      this.extractNoteViewToken(request),
      getRequestSessionMetadata(request),
    );

    this.assertViewSessionPathMatches(
      noteViewSessionId,
      session.noteViewSession.id,
    );

    return this.notesService.streamViewSessionContent(
      session,
      response,
      typeof request.headers.range === 'string'
        ? request.headers.range
        : undefined,
      getRequestSessionMetadata(request),
    );
  }

  private extractNoteViewToken(request: Request) {
    const authorizationHeader = request.headers.authorization;
    if (authorizationHeader?.startsWith('Bearer ')) {
      const token = authorizationHeader.slice('Bearer '.length).trim();
      if (token.length > 0) {
        return token;
      }
    }

    const queryToken = request.query.token;
    if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      return queryToken.trim();
    }

    throw new UnauthorizedException({
      code: 'NOTE_VIEW_TOKEN_REQUIRED',
      message: 'A note view token is required.',
    });
  }

  private assertViewSessionPathMatches(
    expectedSessionId: string,
    resolvedSessionId: string,
  ) {
    if (expectedSessionId === resolvedSessionId) {
      return;
    }

    throw new UnauthorizedException({
      code: 'NOTE_VIEW_TOKEN_INVALID',
      message: 'Note view token is invalid or expired.',
    });
  }
}
