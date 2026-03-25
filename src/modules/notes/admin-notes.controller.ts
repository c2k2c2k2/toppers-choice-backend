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
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  AdminListNotesQueryDto,
  CreateNoteDto,
  UpdateNoteDto,
} from './dto/manage-notes.dto';
import {
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
}
