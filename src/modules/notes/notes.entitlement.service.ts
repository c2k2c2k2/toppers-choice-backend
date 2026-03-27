import { Injectable } from '@nestjs/common';
import { EntitlementKind } from '@prisma/client';
import { EntitlementsService } from '../payments/entitlements.service';
import { NoteRecord } from './notes.types';

@Injectable()
export class NotesEntitlementService {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async canAccessPremiumNote(
    siteId: string,
    userId: string,
    note: Pick<
      NoteRecord,
      'id' | 'subjectId' | 'mediumId' | 'subject' | 'noteTopics'
    >,
  ) {
    return this.entitlementsService.hasEntitlement(
      siteId,
      userId,
      [EntitlementKind.NOTES_PREMIUM],
      {
        noteId: note.id,
        subjectId: note.subjectId,
        mediumId: note.mediumId,
        examTrackId: note.subject.examTrackId,
        topicIds: note.noteTopics.map(({ topic }) => topic.id),
      },
    );
  }
}
