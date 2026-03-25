import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteAccessType, NoteStatus, NoteViewAccessMode } from '@prisma/client';

export class NoteTopicResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  parentId!: string | null;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  isActive!: boolean;
}

export class NoteProgressResponseDto {
  @ApiProperty()
  noteId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  lastPageViewed!: number;

  @ApiProperty()
  maxPageViewed!: number;

  @ApiProperty()
  completionPercent!: number;

  @ApiPropertyOptional({ nullable: true })
  lastViewedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: Date | null;

  @ApiProperty()
  updatedAt!: Date;
}

export class NoteAccessSummaryResponseDto {
  @ApiProperty({ enum: ['FULL', 'PREVIEW', 'LOCKED'] })
  mode!: 'FULL' | 'PREVIEW' | 'LOCKED';

  @ApiProperty()
  canStartViewSession!: boolean;

  @ApiProperty()
  requiresEntitlement!: boolean;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  previewPageCount!: number | null;
}

export class NoteSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  subjectId!: string;

  @ApiPropertyOptional({ nullable: true })
  mediumId!: string | null;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  shortDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  fullFileAssetId!: string;

  @ApiPropertyOptional({ nullable: true })
  previewFileAssetId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  coverImageAssetId!: string | null;

  @ApiProperty({ enum: NoteAccessType })
  accessType!: NoteAccessType;

  @ApiPropertyOptional({ nullable: true })
  previewPageCount!: number | null;

  @ApiProperty()
  pageCount!: number;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty({ enum: NoteStatus })
  status!: NoteStatus;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: Object })
  subject!: {
    id: string;
    name: string;
    slug: string;
    examTrackId: string;
  };

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
  })
  medium!: {
    id: string;
    name: string;
    slug: string;
  } | null;

  @ApiProperty({ type: [NoteTopicResponseDto] })
  topics!: NoteTopicResponseDto[];

  @ApiProperty({ type: NoteAccessSummaryResponseDto })
  access!: NoteAccessSummaryResponseDto;

  @ApiPropertyOptional({ type: NoteProgressResponseDto, nullable: true })
  progress!: NoteProgressResponseDto | null;
}

export class NotesListResponseDto {
  @ApiProperty({ type: [NoteSummaryResponseDto] })
  items!: NoteSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}

export class NotesTreeTopicNodeResponseDto extends NoteTopicResponseDto {
  @ApiProperty({ type: [NoteSummaryResponseDto] })
  notes!: NoteSummaryResponseDto[];

  @ApiProperty({ type: () => [NotesTreeTopicNodeResponseDto] })
  children!: NotesTreeTopicNodeResponseDto[];
}

export class NotesTreeSubjectNodeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  examTrackId!: string;

  @ApiProperty({ type: [NoteSummaryResponseDto] })
  notes!: NoteSummaryResponseDto[];

  @ApiProperty({ type: [NotesTreeTopicNodeResponseDto] })
  topics!: NotesTreeTopicNodeResponseDto[];
}

export class NotesTreeResponseDto {
  @ApiProperty({ type: [NotesTreeSubjectNodeResponseDto] })
  subjects!: NotesTreeSubjectNodeResponseDto[];
}

export class NoteViewSessionResponseDto {
  @ApiProperty()
  noteId!: string;

  @ApiProperty()
  noteViewSessionId!: string;

  @ApiProperty()
  noteViewToken!: string;

  @ApiProperty({ enum: NoteViewAccessMode })
  accessMode!: NoteViewAccessMode;

  @ApiPropertyOptional({ nullable: true })
  previewPageCount!: number | null;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  watermarkPath!: string;

  @ApiProperty()
  contentPath!: string;
}

export class NoteWatermarkResponseDto {
  @ApiProperty()
  noteId!: string;

  @ApiProperty()
  noteViewSessionId!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  maskedEmail!: string;

  @ApiProperty()
  watermarkSeed!: string;

  @ApiProperty({ enum: NoteViewAccessMode })
  accessMode!: NoteViewAccessMode;

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty()
  signature!: string;
}
