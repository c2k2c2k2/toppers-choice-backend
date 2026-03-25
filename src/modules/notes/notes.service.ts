import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileAssetAccess,
  FileAssetStatus,
  FileAssetPurpose,
  NoteAccessLogEventType,
  NoteAccessType,
  NoteStatus,
  NoteViewAccessMode,
  NoteViewSessionStatus,
  SecuritySignalSeverity,
  UserType,
  type Prisma,
} from '@prisma/client';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ObjectStorageService } from '../../infra/storage/object-storage.service';
import {
  AuthenticatedUser,
  NoteViewTokenPayload,
  RequestSessionMetadata,
} from '../auth/auth.types';
import { AuthTokenService } from '../auth/auth-token.service';
import { FILE_PURPOSE_RULES } from '../files/files.constants';
import { NotesEntitlementService } from './notes.entitlement.service';
import { NotesSettingsService } from './notes.settings.service';
import {
  AdminListNotesQueryDto,
  CreateNoteDto,
  ListPublishedNotesQueryDto,
  UpdateNoteDto,
  UpdateNoteProgressDto,
} from './dto/manage-notes.dto';
import {
  mapNoteProgress,
  mapNoteRecord,
  noteProgressSelect,
  noteSelect,
  type NoteAccessSummary,
  type NoteProgressRecord,
  type NoteRecord,
} from './notes.types';
import {
  clampNumber,
  createWatermarkSeed,
  hashOpaqueToken,
  maskEmail,
  parseByteRange,
  signWatermarkPayload,
  slugifyNoteValue,
} from './notes.utils';

type ResolvedViewSession = {
  payload: NoteViewTokenPayload;
  noteViewSession: {
    id: string;
    siteId: string;
    noteId: string;
    userId: string;
    tokenHash: string;
    status: NoteViewSessionStatus;
    accessMode: NoteViewAccessMode;
    previewPageCount: number | null;
    watermarkSeed: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    note: {
      id: string;
      title: string;
      slug: string;
      status: NoteStatus;
      fullFileAssetId: string;
      previewFileAssetId: string | null;
      pageCount: number;
    };
    user: {
      id: string;
      email: string;
      fullName: string;
    };
  };
};

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly notesSettingsService: NotesSettingsService,
    private readonly notesEntitlementService: NotesEntitlementService,
    private readonly configService: ConfigService,
  ) {}

  async listAdminNotes(siteId: string, query: AdminListNotesQueryDto) {
    const where = this.buildAdminNoteWhere(siteId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.note.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        select: noteSelect,
      }),
      this.prisma.note.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        mapNoteRecord(item, this.getAdminAccessSummary(item), null),
      ),
      total,
    };
  }

  async getAdminNote(siteId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        siteId,
      },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Note was not found.',
      });
    }

    return mapNoteRecord(note, this.getAdminAccessSummary(note), null);
  }

  async createNote(user: AuthenticatedUser, input: CreateNoteDto) {
    await this.ensureSubject(user.siteId, input.subjectId);
    if (input.mediumId) {
      await this.ensureMedium(user.siteId, input.mediumId);
    }

    const topicIds = await this.validateTopicIds(
      user.siteId,
      input.subjectId,
      input.topicIds ?? [],
    );
    await this.ensureReadyPdfAsset(user.siteId, input.fullFileAssetId);
    await this.ensureOptionalPreviewAsset(
      user.siteId,
      input.previewFileAssetId,
    );
    await this.ensureOptionalCoverImageAsset(
      user.siteId,
      input.coverImageAssetId,
    );

    const previewPageCount =
      input.accessType === NoteAccessType.PREVIEWABLE_PREMIUM
        ? (input.previewPageCount ??
          (await this.notesSettingsService.getDefaultPreviewPageCount()))
        : null;
    const orderIndex =
      input.orderIndex ?? (await this.getNextNoteOrderIndex(user.siteId));
    const slug = this.resolveSlug(input.slug, input.title);

    const noteId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.note.create({
        data: {
          siteId: user.siteId,
          subjectId: input.subjectId,
          mediumId: input.mediumId ?? null,
          slug,
          title: input.title.trim(),
          shortDescription: input.shortDescription?.trim() || null,
          description: input.description?.trim() || null,
          fullFileAssetId: input.fullFileAssetId,
          previewFileAssetId: input.previewFileAssetId ?? null,
          coverImageAssetId: input.coverImageAssetId ?? null,
          accessType: input.accessType,
          previewPageCount,
          pageCount: input.pageCount,
          orderIndex,
          createdByUserId: user.userId,
          updatedByUserId: user.userId,
        },
        select: {
          id: true,
          siteId: true,
          fullFileAssetId: true,
          previewFileAssetId: true,
          coverImageAssetId: true,
        },
      });

      await this.syncNoteTopics(tx, created.id, topicIds);
      await this.syncNoteAssetReferences(tx, {
        noteId: created.id,
        siteId: created.siteId,
        fullFileAssetId: created.fullFileAssetId,
        previewFileAssetId: created.previewFileAssetId,
        coverImageAssetId: created.coverImageAssetId,
      });

      return created.id;
    });

    return this.getAdminNote(user.siteId, noteId);
  }

  async updateNote(
    user: AuthenticatedUser,
    noteId: string,
    input: UpdateNoteDto,
  ) {
    const existing = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        siteId: user.siteId,
      },
      select: {
        id: true,
        siteId: true,
        subjectId: true,
        mediumId: true,
        title: true,
        slug: true,
        fullFileAssetId: true,
        previewFileAssetId: true,
        coverImageAssetId: true,
        accessType: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Note was not found.',
      });
    }

    const nextSubjectId = input.subjectId ?? existing.subjectId;
    const nextMediumId =
      input.mediumId === undefined ? existing.mediumId : input.mediumId;
    const nextFullFileAssetId =
      input.fullFileAssetId ?? existing.fullFileAssetId;
    const nextPreviewFileAssetId =
      input.previewFileAssetId === undefined
        ? existing.previewFileAssetId
        : input.previewFileAssetId;
    const nextCoverImageAssetId =
      input.coverImageAssetId === undefined
        ? existing.coverImageAssetId
        : input.coverImageAssetId;
    const nextAccessType = input.accessType ?? existing.accessType;

    await this.ensureSubject(user.siteId, nextSubjectId);
    if (nextMediumId) {
      await this.ensureMedium(user.siteId, nextMediumId);
    }

    const topicIds =
      input.topicIds === undefined
        ? undefined
        : await this.validateTopicIds(
            user.siteId,
            nextSubjectId,
            input.topicIds,
          );

    await this.ensureReadyPdfAsset(user.siteId, nextFullFileAssetId);
    await this.ensureOptionalPreviewAsset(user.siteId, nextPreviewFileAssetId);
    await this.ensureOptionalCoverImageAsset(
      user.siteId,
      nextCoverImageAssetId,
    );

    const previewPageCount =
      nextAccessType === NoteAccessType.PREVIEWABLE_PREMIUM
        ? input.previewPageCount === undefined
          ? undefined
          : input.previewPageCount
        : null;
    const slug =
      input.slug === undefined && input.title === undefined
        ? undefined
        : this.resolveSlug(
            input.slug ?? existing.slug,
            input.title ?? existing.title,
          );

    await this.prisma.$transaction(async (tx) => {
      await tx.note.update({
        where: { id: noteId },
        data: {
          subjectId: nextSubjectId,
          mediumId:
            input.mediumId === undefined ? undefined : (nextMediumId ?? null),
          slug,
          title: input.title?.trim(),
          shortDescription:
            input.shortDescription === undefined
              ? undefined
              : input.shortDescription?.trim() || null,
          description:
            input.description === undefined
              ? undefined
              : input.description?.trim() || null,
          fullFileAssetId: nextFullFileAssetId,
          previewFileAssetId:
            input.previewFileAssetId === undefined
              ? undefined
              : (nextPreviewFileAssetId ?? null),
          coverImageAssetId:
            input.coverImageAssetId === undefined
              ? undefined
              : (nextCoverImageAssetId ?? null),
          accessType: nextAccessType,
          previewPageCount,
          pageCount: input.pageCount,
          orderIndex: input.orderIndex,
          updatedByUserId: user.userId,
        },
      });

      if (topicIds) {
        await this.syncNoteTopics(tx, noteId, topicIds);
      }

      await this.syncNoteAssetReferences(tx, {
        noteId,
        siteId: user.siteId,
        fullFileAssetId: nextFullFileAssetId,
        previewFileAssetId: nextPreviewFileAssetId ?? null,
        coverImageAssetId: nextCoverImageAssetId ?? null,
      });
    });

    return this.getAdminNote(user.siteId, noteId);
  }

  async publishNote(user: AuthenticatedUser, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        siteId: user.siteId,
      },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Note was not found.',
      });
    }

    await this.assertPublishableNote(user.siteId, note);

    await this.prisma.note.update({
      where: { id: noteId },
      data: {
        status: NoteStatus.PUBLISHED,
        publishedAt: new Date(),
        archivedAt: null,
        publishedByUserId: user.userId,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminNote(user.siteId, noteId);
  }

  async unpublishNote(user: AuthenticatedUser, noteId: string) {
    const existing = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        siteId: user.siteId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Note was not found.',
      });
    }

    await this.prisma.note.update({
      where: { id: noteId },
      data: {
        status: NoteStatus.DRAFT,
        updatedByUserId: user.userId,
      },
    });

    return this.getAdminNote(user.siteId, noteId);
  }

  async listPublishedNotes(
    user: AuthenticatedUser,
    query: ListPublishedNotesQueryDto,
  ) {
    const where = this.buildPublishedNoteWhere(user.siteId, query);
    const [notes, total] = await this.prisma.$transaction([
      this.prisma.note.findMany({
        where,
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
        select: noteSelect,
      }),
      this.prisma.note.count({ where }),
    ]);
    const items = await this.mapPublishedNoteRecords(user, notes);

    return {
      items,
      total,
    };
  }

  async getPublishedNote(user: AuthenticatedUser, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        siteId: user.siteId,
        status: NoteStatus.PUBLISHED,
      },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Published note was not found.',
      });
    }

    const [progress] = await this.getProgressMapForUser(user.userId, [note.id]);
    const access = await this.resolveAccessForUser(user, note);

    return mapNoteRecord(note, access, progress.get(note.id) ?? null);
  }

  async getPublishedNotesTree(user: AuthenticatedUser) {
    const notes = await this.prisma.note.findMany({
      where: {
        siteId: user.siteId,
        status: NoteStatus.PUBLISHED,
      },
      orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
      select: noteSelect,
    });
    const items = await this.mapPublishedNoteRecords(user, notes);
    const notesById = new Map(items.map((item) => [item.id, item]));
    const subjectIds = Array.from(new Set(notes.map((note) => note.subjectId)));
    const topics = await this.prisma.topic.findMany({
      where: {
        siteId: user.siteId,
        subjectId: {
          in: subjectIds,
        },
        isActive: true,
      },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        subjectId: true,
        code: true,
        slug: true,
        name: true,
        parentId: true,
        orderIndex: true,
        isActive: true,
      },
    });

    const notesBySubject = new Map<string, typeof items>();
    const notesByTopic = new Map<string, typeof items>();

    for (const item of items) {
      if (item.topics.length === 0) {
        const subjectNotes = notesBySubject.get(item.subjectId) ?? [];
        subjectNotes.push(item);
        notesBySubject.set(item.subjectId, subjectNotes);
        continue;
      }

      for (const topic of item.topics) {
        const topicNotes = notesByTopic.get(topic.id) ?? [];
        topicNotes.push(item);
        notesByTopic.set(topic.id, topicNotes);
      }
    }

    const topicsById = new Map(
      topics.map((topic) => [
        topic.id,
        {
          ...topic,
          notes: notesByTopic.get(topic.id) ?? [],
          children: [] as Array<Record<string, unknown>>,
        },
      ]),
    );

    for (const topic of topicsById.values()) {
      if (!topic.parentId) {
        continue;
      }

      const parent = topicsById.get(topic.parentId);
      if (parent) {
        parent.children.push(topic);
      }
    }

    const subjects = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        examTrackId: string;
        notes: typeof items;
        topics: Array<Record<string, unknown>>;
      }
    >();

    for (const note of notes) {
      if (!subjects.has(note.subject.id)) {
        subjects.set(note.subject.id, {
          id: note.subject.id,
          name: note.subject.name,
          slug: note.subject.slug,
          examTrackId: note.subject.examTrackId,
          notes: notesBySubject.get(note.subject.id) ?? [],
          topics: [],
        });
      }
    }

    for (const topic of topicsById.values()) {
      if (topic.parentId) {
        continue;
      }

      const subject = subjects.get(topic.subjectId);
      if (subject) {
        subject.topics.push(topic);
      }
    }

    return {
      subjects: Array.from(subjects.values()).sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    };
  }

  async createViewSession(
    user: AuthenticatedUser,
    noteId: string,
    requestMetadata: RequestSessionMetadata,
  ) {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        siteId: user.siteId,
        status: NoteStatus.PUBLISHED,
      },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Published note was not found.',
      });
    }

    const access = await this.resolveAccessForUser(user, note);
    if (!access.canStartViewSession || access.mode === 'LOCKED') {
      throw new ForbiddenException({
        code: 'NOTE_ACCESS_DENIED',
        message:
          access.reason ?? 'You cannot start a view session for this note.',
      });
    }

    const expiresInMinutes =
      await this.notesSettingsService.getViewSessionTtlMinutes(user.siteId);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);
    const created = await this.prisma.noteViewSession.create({
      data: {
        siteId: user.siteId,
        noteId: note.id,
        userId: user.userId,
        authSessionId: user.sessionId,
        tokenHash: randomUUID(),
        accessMode:
          access.mode === 'FULL'
            ? NoteViewAccessMode.FULL
            : NoteViewAccessMode.PREVIEW,
        previewPageCount: access.previewPageCount,
        watermarkSeed: createWatermarkSeed(),
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        expiresAt,
      },
      select: {
        id: true,
      },
    });
    const noteViewToken = await this.authTokenService.issueNoteViewToken(
      {
        sub: user.userId,
        siteId: user.siteId,
        noteId: note.id,
        noteViewSessionId: created.id,
        accessMode: access.mode === 'FULL' ? 'FULL' : 'PREVIEW',
      },
      expiresInMinutes,
    );

    await this.prisma.noteViewSession.update({
      where: {
        id: created.id,
      },
      data: {
        tokenHash: hashOpaqueToken(noteViewToken),
      },
    });

    await this.prisma.noteAccessLog.create({
      data: {
        siteId: user.siteId,
        noteId: note.id,
        userId: user.userId,
        noteViewSessionId: created.id,
        eventType: NoteAccessLogEventType.VIEW_SESSION_CREATED,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metaJson: {
          accessMode: access.mode,
          previewPageCount: access.previewPageCount,
        },
      },
    });

    return {
      noteId: note.id,
      noteViewSessionId: created.id,
      noteViewToken,
      accessMode:
        access.mode === 'FULL'
          ? NoteViewAccessMode.FULL
          : NoteViewAccessMode.PREVIEW,
      previewPageCount: access.previewPageCount,
      expiresAt,
      watermarkPath: `/notes/view-sessions/${created.id}/watermark`,
      contentPath: `/notes/view-sessions/${created.id}/content`,
    };
  }

  async resolveViewSessionFromToken(
    token: string,
    requestMetadata: RequestSessionMetadata,
  ): Promise<ResolvedViewSession> {
    const payload = await this.authTokenService.verifyNoteViewToken(token);
    const noteViewSession = await this.prisma.noteViewSession.findFirst({
      where: {
        id: payload.noteViewSessionId,
        siteId: payload.siteId,
      },
      select: {
        id: true,
        siteId: true,
        noteId: true,
        userId: true,
        tokenHash: true,
        status: true,
        accessMode: true,
        previewPageCount: true,
        watermarkSeed: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        revokedAt: true,
        note: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            fullFileAssetId: true,
            previewFileAssetId: true,
            pageCount: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    if (
      !noteViewSession ||
      noteViewSession.noteId !== payload.noteId ||
      noteViewSession.userId !== payload.sub
    ) {
      throw new UnauthorizedException({
        code: 'NOTE_VIEW_TOKEN_INVALID',
        message: 'Note view token is invalid or expired.',
      });
    }

    if (noteViewSession.tokenHash !== hashOpaqueToken(token)) {
      throw new UnauthorizedException({
        code: 'NOTE_VIEW_TOKEN_INVALID',
        message: 'Note view token is invalid or expired.',
      });
    }

    if (
      noteViewSession.status !== NoteViewSessionStatus.ACTIVE ||
      noteViewSession.revokedAt ||
      noteViewSession.expiresAt <= new Date()
    ) {
      await this.prisma.noteViewSession.updateMany({
        where: {
          id: noteViewSession.id,
          status: NoteViewSessionStatus.ACTIVE,
          expiresAt: {
            lte: new Date(),
          },
        },
        data: {
          status: NoteViewSessionStatus.EXPIRED,
        },
      });

      throw new UnauthorizedException({
        code: 'NOTE_VIEW_TOKEN_INVALID',
        message: 'Note view token is invalid or expired.',
      });
    }

    if (noteViewSession.note.status !== NoteStatus.PUBLISHED) {
      throw new ForbiddenException({
        code: 'NOTE_NOT_PUBLISHED',
        message: 'This note is no longer published.',
      });
    }

    await this.recordViewSessionReuseSignals(noteViewSession, requestMetadata);

    return {
      payload,
      noteViewSession,
    };
  }

  async getWatermarkPayload(
    session: ResolvedViewSession,
    requestMetadata: RequestSessionMetadata,
  ) {
    await this.prisma.noteViewSession.update({
      where: {
        id: session.noteViewSession.id,
      },
      data: {
        lastAccessedAt: new Date(),
      },
    });

    await this.prisma.noteAccessLog.create({
      data: {
        siteId: session.noteViewSession.siteId,
        noteId: session.noteViewSession.noteId,
        userId: session.noteViewSession.userId,
        noteViewSessionId: session.noteViewSession.id,
        eventType: NoteAccessLogEventType.WATERMARK_FETCHED,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      },
    });

    const generatedAt = new Date().toISOString();
    const payload = {
      noteId: session.noteViewSession.noteId,
      noteViewSessionId: session.noteViewSession.id,
      displayName: session.noteViewSession.user.fullName,
      maskedEmail: maskEmail(session.noteViewSession.user.email),
      watermarkSeed: session.noteViewSession.watermarkSeed,
      accessMode: session.noteViewSession.accessMode,
      generatedAt,
    };

    return {
      ...payload,
      signature: signWatermarkPayload(
        payload,
        this.configService.get<string>('JWT_ACCESS_SECRET') ??
          'notes-watermark',
      ),
    };
  }

  async streamViewSessionContent(
    session: ResolvedViewSession,
    response: Response,
    rangeHeader: string | undefined,
    requestMetadata: RequestSessionMetadata,
  ) {
    const fileAssetId =
      session.noteViewSession.accessMode === NoteViewAccessMode.FULL
        ? session.noteViewSession.note.fullFileAssetId
        : session.noteViewSession.note.previewFileAssetId;

    if (!fileAssetId) {
      await this.createSecuritySignal({
        siteId: session.noteViewSession.siteId,
        noteId: session.noteViewSession.noteId,
        userId: session.noteViewSession.userId,
        noteViewSessionId: session.noteViewSession.id,
        signalKey: 'note.preview_asset_missing',
        severity: SecuritySignalSeverity.HIGH,
        metaJson: {
          accessMode: session.noteViewSession.accessMode,
        },
      });

      throw new ForbiddenException({
        code: 'NOTE_PREVIEW_UNAVAILABLE',
        message: 'Preview content is not available for this note.',
      });
    }

    const fileAsset = await this.prisma.fileAsset.findFirst({
      where: {
        id: fileAssetId,
        siteId: session.noteViewSession.siteId,
        status: FileAssetStatus.READY,
      },
      select: {
        id: true,
        objectKey: true,
        sizeBytes: true,
        contentType: true,
        originalFileName: true,
        etag: true,
      },
    });

    if (!fileAsset || !fileAsset.sizeBytes) {
      throw new NotFoundException({
        code: 'NOTE_FILE_ASSET_NOT_FOUND',
        message: 'The note PDF asset could not be resolved.',
      });
    }

    const parsedRange = parseByteRange(rangeHeader, fileAsset.sizeBytes);
    if (parsedRange && 'error' in parsedRange) {
      await this.createSecuritySignal({
        siteId: session.noteViewSession.siteId,
        noteId: session.noteViewSession.noteId,
        userId: session.noteViewSession.userId,
        noteViewSessionId: session.noteViewSession.id,
        signalKey: 'note.invalid_range_request',
        severity: SecuritySignalSeverity.MEDIUM,
        metaJson: {
          rangeHeader,
        },
      });

      response.setHeader('Content-Range', `bytes */${fileAsset.sizeBytes}`);
      throw new HttpException(
        {
          code: parsedRange.error,
          message: parsedRange.message,
        },
        416,
      );
    }

    const object = parsedRange
      ? await this.objectStorageService.readObjectRange({
          objectKey: fileAsset.objectKey,
          offset: parsedRange.start,
          length: parsedRange.length,
        })
      : await this.objectStorageService.readObject(fileAsset.objectKey);

    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader(
      'Content-Type',
      object.contentType ?? fileAsset.contentType,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${fileAsset.originalFileName.replaceAll('"', '\\"')}"`,
    );

    if (object.eTag) {
      response.setHeader('ETag', object.eTag);
    }

    if (object.lastModified) {
      response.setHeader('Last-Modified', object.lastModified.toUTCString());
    }

    if (parsedRange) {
      response.status(206);
      response.setHeader(
        'Content-Range',
        `bytes ${parsedRange.start}-${parsedRange.end}/${fileAsset.sizeBytes}`,
      );
      response.setHeader('Content-Length', String(parsedRange.length));
    } else {
      response.status(200);
      response.setHeader('Content-Length', String(fileAsset.sizeBytes));
    }

    await this.prisma.noteViewSession.update({
      where: {
        id: session.noteViewSession.id,
      },
      data: {
        lastAccessedAt: new Date(),
      },
    });

    await this.prisma.noteAccessLog.create({
      data: {
        siteId: session.noteViewSession.siteId,
        noteId: session.noteViewSession.noteId,
        userId: session.noteViewSession.userId,
        noteViewSessionId: session.noteViewSession.id,
        eventType: NoteAccessLogEventType.CONTENT_STREAMED,
        rangeStart: parsedRange ? parsedRange.start : 0,
        rangeEnd: parsedRange ? parsedRange.end : fileAsset.sizeBytes - 1,
        bytesServed: parsedRange ? parsedRange.length : fileAsset.sizeBytes,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metaJson: {
          accessMode: session.noteViewSession.accessMode,
        },
      },
    });

    return new StreamableFile(object.body);
  }

  async updateProgress(
    user: AuthenticatedUser,
    noteId: string,
    input: UpdateNoteProgressDto,
    requestMetadata: RequestSessionMetadata,
  ) {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        siteId: user.siteId,
        status: NoteStatus.PUBLISHED,
      },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundException({
        code: 'NOTE_NOT_FOUND',
        message: 'Published note was not found.',
      });
    }

    const access = await this.resolveAccessForUser(user, note);
    if (!access.canStartViewSession) {
      throw new ForbiddenException({
        code: 'NOTE_ACCESS_DENIED',
        message: access.reason ?? 'You cannot record progress for this note.',
      });
    }

    const lastPageViewed = clampNumber(input.lastPageViewed, 0, note.pageCount);
    const completionPercent =
      note.pageCount > 0
        ? clampNumber(
            Math.round((lastPageViewed / note.pageCount) * 100),
            0,
            100,
          )
        : 0;
    const now = new Date();
    const existingProgress = await this.prisma.noteProgress.findUnique({
      where: {
        noteId_userId: {
          noteId: note.id,
          userId: user.userId,
        },
      },
      select: {
        maxPageViewed: true,
      },
    });
    const progress = await this.prisma.noteProgress.upsert({
      where: {
        noteId_userId: {
          noteId: note.id,
          userId: user.userId,
        },
      },
      update: {
        lastPageViewed,
        maxPageViewed: Math.max(
          existingProgress?.maxPageViewed ?? 0,
          lastPageViewed,
        ),
        completionPercent,
        lastViewedAt: now,
        completedAt: completionPercent >= 100 ? now : null,
      },
      create: {
        siteId: user.siteId,
        noteId: note.id,
        userId: user.userId,
        lastPageViewed,
        maxPageViewed: lastPageViewed,
        completionPercent,
        lastViewedAt: now,
        completedAt: completionPercent >= 100 ? now : null,
      },
      select: noteProgressSelect,
    });

    await this.prisma.noteAccessLog.create({
      data: {
        siteId: user.siteId,
        noteId: note.id,
        userId: user.userId,
        eventType: NoteAccessLogEventType.PROGRESS_UPDATED,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metaJson: {
          lastPageViewed,
          completionPercent,
        },
      },
    });

    return mapNoteProgress(progress);
  }

  private buildAdminNoteWhere(
    siteId: string,
    query: AdminListNotesQueryDto,
  ): Prisma.NoteWhereInput {
    return {
      siteId,
      subjectId: query.subjectId,
      status: query.status,
      accessType: query.accessType,
      noteTopics: query.topicId
        ? {
            some: {
              topicId: query.topicId,
            },
          }
        : undefined,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: 'insensitive' } },
            { slug: { contains: query.search, mode: 'insensitive' } },
            {
              shortDescription: { contains: query.search, mode: 'insensitive' },
            },
          ]
        : undefined,
    };
  }

  private buildPublishedNoteWhere(
    siteId: string,
    query: ListPublishedNotesQueryDto,
  ): Prisma.NoteWhereInput {
    return {
      siteId,
      status: NoteStatus.PUBLISHED,
      subjectId: query.subjectId,
      mediumId: query.mediumId,
      noteTopics: query.topicId
        ? {
            some: {
              topicId: query.topicId,
            },
          }
        : undefined,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: 'insensitive' } },
            { slug: { contains: query.search, mode: 'insensitive' } },
            {
              shortDescription: { contains: query.search, mode: 'insensitive' },
            },
          ]
        : undefined,
    };
  }

  private async mapPublishedNoteRecords(
    user: AuthenticatedUser,
    notes: NoteRecord[],
  ) {
    const [progressMap] = await this.getProgressMapForUser(
      user.userId,
      notes.map((note) => note.id),
    );

    return Promise.all(
      notes.map(async (note) =>
        mapNoteRecord(
          note,
          await this.resolveAccessForUser(user, note),
          progressMap.get(note.id) ?? null,
        ),
      ),
    );
  }

  private async getProgressMapForUser(userId: string, noteIds: string[]) {
    if (noteIds.length === 0) {
      return [new Map<string, NoteProgressRecord>()] as const;
    }

    const progressRecords = await this.prisma.noteProgress.findMany({
      where: {
        userId,
        noteId: {
          in: noteIds,
        },
      },
      select: noteProgressSelect,
    });

    return [
      new Map(progressRecords.map((record) => [record.noteId, record])),
    ] as const;
  }

  private async resolveAccessForUser(
    user: AuthenticatedUser,
    note: NoteRecord,
  ): Promise<NoteAccessSummary> {
    if (user.userType === UserType.ADMIN) {
      return this.getAdminAccessSummary(note);
    }

    if (note.accessType === NoteAccessType.FREE) {
      return {
        mode: 'FULL',
        canStartViewSession: true,
        requiresEntitlement: false,
        reason: null,
        previewPageCount: null,
      };
    }

    const hasPremiumAccess =
      await this.notesEntitlementService.canAccessPremiumNote(
        user.userId,
        note.id,
      );
    if (hasPremiumAccess) {
      return {
        mode: 'FULL',
        canStartViewSession: true,
        requiresEntitlement: true,
        reason: null,
        previewPageCount: null,
      };
    }

    if (note.accessType === NoteAccessType.PREVIEWABLE_PREMIUM) {
      return {
        mode: note.previewFileAssetId ? 'PREVIEW' : 'LOCKED',
        canStartViewSession: Boolean(note.previewFileAssetId),
        requiresEntitlement: true,
        reason: note.previewFileAssetId
          ? 'Preview access is available for this premium note.'
          : 'Preview access is not configured for this premium note.',
        previewPageCount: note.previewPageCount,
      };
    }

    return {
      mode: 'LOCKED',
      canStartViewSession: false,
      requiresEntitlement: true,
      reason: 'Active premium entitlement is required for this note.',
      previewPageCount: null,
    };
  }

  private getAdminAccessSummary(_note: NoteRecord): NoteAccessSummary {
    return {
      mode: 'FULL',
      canStartViewSession: true,
      requiresEntitlement: false,
      reason: null,
      previewPageCount: null,
    };
  }

  private async assertPublishableNote(siteId: string, note: NoteRecord) {
    await this.ensureReadyPdfAsset(siteId, note.fullFileAssetId);

    if (note.accessType === NoteAccessType.PREVIEWABLE_PREMIUM) {
      if (!note.previewFileAssetId) {
        throw new BadRequestException({
          code: 'NOTE_PREVIEW_ASSET_REQUIRED',
          message: 'Previewable premium notes require a dedicated preview PDF.',
        });
      }

      await this.ensureReadyPdfAsset(siteId, note.previewFileAssetId);

      if (!note.previewPageCount || note.previewPageCount <= 0) {
        throw new BadRequestException({
          code: 'NOTE_PREVIEW_PAGE_COUNT_REQUIRED',
          message:
            'Previewable premium notes require an explicit preview page count.',
        });
      }
    }
  }

  private async ensureSubject(siteId: string, subjectId: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (!subject) {
      throw new BadRequestException({
        code: 'SUBJECT_NOT_FOUND',
        message: 'Subject was not found for this site.',
      });
    }
  }

  private async ensureMedium(siteId: string, mediumId: string) {
    const medium = await this.prisma.medium.findFirst({
      where: {
        id: mediumId,
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (!medium) {
      throw new BadRequestException({
        code: 'MEDIUM_NOT_FOUND',
        message: 'Medium was not found for this site.',
      });
    }
  }

  private async validateTopicIds(
    siteId: string,
    subjectId: string,
    topicIds: string[],
  ) {
    const uniqueIds: string[] = Array.from(new Set(topicIds));
    if (uniqueIds.length === 0) {
      return uniqueIds;
    }

    const topics = await this.prisma.topic.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
        siteId,
        subjectId,
      },
      select: {
        id: true,
      },
    });

    if (topics.length !== uniqueIds.length) {
      throw new BadRequestException({
        code: 'INVALID_NOTE_TOPIC_IDS',
        message:
          'One or more note topic ids do not belong to the selected subject.',
      });
    }

    return uniqueIds;
  }

  private async ensureReadyPdfAsset(siteId: string, assetId: string) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId,
      },
      select: {
        id: true,
        purpose: true,
        status: true,
        contentType: true,
      },
    });

    if (
      !asset ||
      asset.status !== FileAssetStatus.READY ||
      asset.purpose !== FileAssetPurpose.NOTE_PDF ||
      !FILE_PURPOSE_RULES[
        FileAssetPurpose.NOTE_PDF
      ].allowedContentTypes.includes(asset.contentType)
    ) {
      throw new BadRequestException({
        code: 'INVALID_NOTE_FILE_ASSET',
        message: 'A ready PDF file asset is required for note content.',
      });
    }
  }

  private async ensureOptionalPreviewAsset(
    siteId: string,
    assetId?: string | null,
  ) {
    if (!assetId) {
      return;
    }

    await this.ensureReadyPdfAsset(siteId, assetId);
  }

  private async ensureOptionalCoverImageAsset(
    siteId: string,
    assetId?: string | null,
  ) {
    if (!assetId) {
      return;
    }

    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: assetId,
        siteId,
        status: FileAssetStatus.READY,
      },
      select: {
        id: true,
        contentType: true,
      },
    });

    if (!asset || !asset.contentType.startsWith('image/')) {
      throw new BadRequestException({
        code: 'INVALID_NOTE_COVER_ASSET',
        message: 'A ready image asset is required for note cover images.',
      });
    }
  }

  private async getNextNoteOrderIndex(siteId: string) {
    const aggregate = await this.prisma.note.aggregate({
      where: { siteId },
      _max: { orderIndex: true },
    });

    return (aggregate._max.orderIndex ?? 0) + 10;
  }

  private resolveSlug(slug: string | undefined, title: string) {
    const normalized = slugifyNoteValue(slug ?? title);
    if (!normalized) {
      throw new BadRequestException({
        code: 'INVALID_NOTE_SLUG',
        message: 'Note slug could not be resolved from the provided value.',
      });
    }

    return normalized;
  }

  private async syncNoteTopics(
    tx: Prisma.TransactionClient,
    noteId: string,
    topicIds: string[],
  ) {
    await tx.noteTopic.deleteMany({
      where: {
        noteId,
      },
    });

    if (topicIds.length === 0) {
      return;
    }

    await tx.noteTopic.createMany({
      data: topicIds.map((topicId) => ({
        noteId,
        topicId,
      })),
      skipDuplicates: true,
    });
  }

  private async syncNoteAssetReferences(
    tx: Prisma.TransactionClient,
    input: {
      noteId: string;
      siteId: string;
      fullFileAssetId: string;
      previewFileAssetId: string | null;
      coverImageAssetId: string | null;
    },
  ) {
    await tx.fileAssetReference.deleteMany({
      where: {
        siteId: input.siteId,
        resourceType: 'note',
        resourceId: input.noteId,
      },
    });

    const references: Array<{
      fileAssetId: string;
      slot: string;
      accessLevel: FileAssetAccess;
    }> = [
      {
        fileAssetId: input.fullFileAssetId,
        slot: 'full_pdf',
        accessLevel: FileAssetAccess.PROTECTED,
      },
    ];

    if (input.previewFileAssetId) {
      references.push({
        fileAssetId: input.previewFileAssetId,
        slot: 'preview_pdf',
        accessLevel: FileAssetAccess.PROTECTED,
      });
    }

    if (input.coverImageAssetId) {
      references.push({
        fileAssetId: input.coverImageAssetId,
        slot: 'cover_image',
        accessLevel: FileAssetAccess.PROTECTED,
      });
    }

    if (references.length === 0) {
      return;
    }

    await tx.fileAssetReference.createMany({
      data: references.map((reference) => ({
        siteId: input.siteId,
        fileAssetId: reference.fileAssetId,
        resourceType: 'note',
        resourceId: input.noteId,
        slot: reference.slot,
        accessLevel: reference.accessLevel,
      })),
      skipDuplicates: true,
    });
  }

  private async recordViewSessionReuseSignals(
    session: ResolvedViewSession['noteViewSession'],
    requestMetadata: RequestSessionMetadata,
  ) {
    if (
      session.ipAddress &&
      requestMetadata.ipAddress &&
      session.ipAddress !== requestMetadata.ipAddress
    ) {
      await this.createSecuritySignal({
        siteId: session.siteId,
        noteId: session.noteId,
        userId: session.userId,
        noteViewSessionId: session.id,
        signalKey: 'note.view_session_ip_changed',
        severity: SecuritySignalSeverity.MEDIUM,
        metaJson: {
          originalIpAddress: session.ipAddress,
          currentIpAddress: requestMetadata.ipAddress,
        },
      });
    }

    if (
      session.userAgent &&
      requestMetadata.userAgent &&
      session.userAgent !== requestMetadata.userAgent
    ) {
      await this.createSecuritySignal({
        siteId: session.siteId,
        noteId: session.noteId,
        userId: session.userId,
        noteViewSessionId: session.id,
        signalKey: 'note.view_session_user_agent_changed',
        severity: SecuritySignalSeverity.LOW,
        metaJson: {
          originalUserAgent: session.userAgent,
          currentUserAgent: requestMetadata.userAgent,
        },
      });
    }
  }

  private async createSecuritySignal(
    data: Prisma.NoteSecuritySignalUncheckedCreateInput,
  ) {
    await this.prisma.noteSecuritySignal.create({
      data,
    });
  }
}
