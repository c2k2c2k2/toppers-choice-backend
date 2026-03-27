import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  AdminListNotesQueryDto,
  CreateNoteIndexEntryDto,
  CreateNoteDto,
  UpdateNoteIndexEntryDto,
  UpdateNoteDto,
} from './dto/manage-notes.dto';
import {
  NoteIndexEntryResponseDto,
  NoteIndexListResponseDto,
  NotesListResponseDto,
  NoteSummaryResponseDto,
} from './dto/note-response.dto';
import { NotesService } from './notes.service';

@ApiTags('admin-notes')
@ApiBearerAuth('access-token')
@Controller('admin/notes')
export class AdminNotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @Policy('content.notes.read')
  @ApiOkResponse({ type: NotesListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AdminListNotesQueryDto,
  ) {
    return this.notesService.listAdminNotes(user.siteId, query);
  }

  @Get(':noteId')
  @Policy('content.notes.read')
  @ApiOkResponse({ type: NoteSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.getAdminNote(user.siteId, noteId);
  }

  @Post()
  @Policy('content.notes.manage')
  @Audit({
    action: 'admin.notes.create',
    resourceType: 'note',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['title', 'slug', 'subjectId', 'mediumId', 'accessType'],
  })
  @ApiCreatedResponse({ type: NoteSummaryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createNote(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateNoteDto,
  ) {
    return this.notesService.createNote(user, body);
  }

  @Patch(':noteId')
  @Policy('content.notes.manage')
  @Audit({
    action: 'admin.notes.update',
    resourceType: 'note',
    resourceIdParam: 'noteId',
    includeBodyKeys: ['title', 'slug', 'subjectId', 'mediumId', 'accessType'],
  })
  @ApiOkResponse({ type: NoteSummaryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Body() body: UpdateNoteDto,
  ) {
    return this.notesService.updateNote(user, noteId, body);
  }

  @Post(':noteId/publish')
  @Policy('content.notes.publish')
  @Audit({
    action: 'admin.notes.publish',
    resourceType: 'note',
    resourceIdParam: 'noteId',
  })
  @ApiOkResponse({ type: NoteSummaryResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async publishNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.publishNote(user, noteId);
  }

  @Post(':noteId/unpublish')
  @Policy('content.notes.publish')
  @Audit({
    action: 'admin.notes.unpublish',
    resourceType: 'note',
    resourceIdParam: 'noteId',
  })
  @ApiOkResponse({ type: NoteSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async unpublishNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.unpublishNote(user, noteId);
  }

  @Get(':noteId/index')
  @Policy('content.notes.read')
  @ApiOkResponse({ type: NoteIndexListResponseDto })
  async listNoteIndexEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
  ) {
    return this.notesService.listAdminNoteIndexEntries(user.siteId, noteId);
  }

  @Post(':noteId/index')
  @Policy('content.notes.manage')
  @Audit({
    action: 'admin.notes.index.create',
    resourceType: 'note_index_entry',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['serialLabel', 'title', 'pageNumber', 'orderIndex'],
  })
  @ApiCreatedResponse({ type: NoteIndexEntryResponseDto })
  async createNoteIndexEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Body() body: CreateNoteIndexEntryDto,
  ) {
    return this.notesService.createNoteIndexEntry(user, noteId, body);
  }

  @Patch(':noteId/index/:entryId')
  @Policy('content.notes.manage')
  @Audit({
    action: 'admin.notes.index.update',
    resourceType: 'note_index_entry',
    resourceIdParam: 'entryId',
    includeBodyKeys: ['serialLabel', 'title', 'pageNumber', 'orderIndex'],
  })
  @ApiOkResponse({ type: NoteIndexEntryResponseDto })
  async updateNoteIndexEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Param('entryId') entryId: string,
    @Body() body: UpdateNoteIndexEntryDto,
  ) {
    return this.notesService.updateNoteIndexEntry(user, noteId, entryId, body);
  }

  @Delete(':noteId/index/:entryId')
  @Policy('content.notes.manage')
  @Audit({
    action: 'admin.notes.index.delete',
    resourceType: 'note_index_entry',
    resourceIdParam: 'entryId',
  })
  @ApiOkResponse({ type: ActionMessageResponseDto })
  async deleteNoteIndexEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('noteId') noteId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.notesService.deleteNoteIndexEntry(user, noteId, entryId);
  }
}
