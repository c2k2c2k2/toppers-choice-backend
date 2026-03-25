import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminNotesController } from './admin-notes.controller';
import { NotesController } from './notes.controller';
import { NotesEntitlementService } from './notes.entitlement.service';
import { NotesSettingsService } from './notes.settings.service';
import { NotesService } from './notes.service';
import { NoteViewSessionsController } from './note-view-sessions.controller';

@Module({
  imports: [AuthModule, AuthorizationModule, SiteSettingsModule],
  controllers: [
    AdminNotesController,
    NotesController,
    NoteViewSessionsController,
  ],
  providers: [NotesService, NotesSettingsService, NotesEntitlementService],
  exports: [NotesService],
})
export class NotesModule {}
