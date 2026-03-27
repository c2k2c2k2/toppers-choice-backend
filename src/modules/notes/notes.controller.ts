import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { getRequestSessionMetadata } from '../auth/auth.utils';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  UpsertNoteBookmarkDto,
  ListPublishedNotesQueryDto,
  UpdateNoteProgressDto,
} from './dto/manage-notes.dto';
import {
  NoteBookmarkListResponseDto,
  NoteBookmarkResponseDto,
  NoteIndexListResponseDto,
  NoteProgressResponseDto,
  NotesListResponseDto,
  NotesTreeResponseDto,
  NoteSummaryResponseDto,
  NoteViewSessionResponseDto,
} from './dto/note-response.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiBearerAuth('access-token')
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @ApiOkResponse({ type: NotesListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listPublishedNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPublishedNotesQueryDto,
  ) {
    return this.notesService.listPublishedNotes(user, query);
  }

  @Get('tree')
  @ApiOkResponse({ type: NotesTreeResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getPublishedNotesTree(@CurrentUser() user: AuthenticatedUser) {
    return this.notesService.getPublishedNotesTree(user);
  }

  @Get(':noteId')
  @ApiOkResponse({ type: NoteSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getPublishedNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.getPublishedNote(user, noteId);
  }

  @Get(':noteId/index')
  @ApiOkResponse({ type: NoteIndexListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getPublishedNoteIndex(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.listPublishedNoteIndexEntries(user, noteId);
  }

  @Post(':noteId/view-session')
  @ApiCreatedResponse({ type: NoteViewSessionResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async createViewSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Req() request: Request,
  ) {
    return this.notesService.createViewSession(
      user,
      noteId,
      getRequestSessionMetadata(request),
    );
  }

  @Post(':noteId/progress')
  @ApiOkResponse({ type: NoteProgressResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Body() body: UpdateNoteProgressDto,
    @Req() request: Request,
  ) {
    return this.notesService.updateProgress(
      user,
      noteId,
      body,
      getRequestSessionMetadata(request),
    );
  }

  @Get(':noteId/bookmarks')
  @ApiOkResponse({ type: NoteBookmarkListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listBookmarks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.listNoteBookmarks(user, noteId);
  }

  @Post(':noteId/bookmarks')
  @ApiCreatedResponse({ type: NoteBookmarkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async createBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Body() body: UpsertNoteBookmarkDto,
  ) {
    return this.notesService.createNoteBookmark(user, noteId, body);
  }

  @Patch(':noteId/bookmarks/:bookmarkId')
  @ApiOkResponse({ type: NoteBookmarkResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async updateBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Param('bookmarkId') bookmarkId: string,
    @Body() body: UpsertNoteBookmarkDto,
  ) {
    return this.notesService.updateNoteBookmark(user, noteId, bookmarkId, body);
  }

  @Delete(':noteId/bookmarks/:bookmarkId')
  @ApiOkResponse({ type: ActionMessageResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async deleteBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Param('bookmarkId') bookmarkId: string,
  ) {
    return this.notesService.deleteNoteBookmark(user, noteId, bookmarkId);
  }
}
