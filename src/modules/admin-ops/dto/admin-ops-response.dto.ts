import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SecuritySignalSeverity } from '@prisma/client';

class OpsDashboardUsersDto {
  @ApiProperty()
  students!: number;

  @ApiProperty()
  admins!: number;
}

class OpsDashboardCommercialDto {
  @ApiProperty()
  activeSubscriptions!: number;

  @ApiProperty()
  successfulOrders!: number;
}

class OpsDashboardOperationalDto {
  @ApiProperty()
  pendingUploads!: number;

  @ApiProperty()
  unreadStudentNotifications!: number;

  @ApiProperty()
  recentSecuritySignals!: number;
}

export class AdminOpsDashboardResponseDto {
  @ApiProperty({ type: OpsDashboardUsersDto })
  users!: OpsDashboardUsersDto;

  @ApiProperty({ type: OpsDashboardCommercialDto })
  commercial!: OpsDashboardCommercialDto;

  @ApiProperty({ type: OpsDashboardOperationalDto })
  operational!: OpsDashboardOperationalDto;
}

export class AdminContentHealthResponseDto {
  @ApiProperty()
  cmsDraftPages!: number;

  @ApiProperty()
  cmsDraftSections!: number;

  @ApiProperty()
  draftNotes!: number;

  @ApiProperty()
  draftStructuredContent!: number;

  @ApiProperty()
  draftQuestions!: number;

  @ApiProperty()
  draftTests!: number;

  @ApiProperty()
  pendingFileUploads!: number;
}

export class NoteSecuritySignalResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  noteId!: string;

  @ApiProperty()
  noteTitle!: string;

  @ApiPropertyOptional()
  userId!: string | null;

  @ApiPropertyOptional()
  userEmail!: string | null;

  @ApiProperty()
  signalKey!: string;

  @ApiProperty({ enum: SecuritySignalSeverity })
  severity!: SecuritySignalSeverity;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metaJson!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;
}

export class NoteSecuritySignalsListResponseDto {
  @ApiProperty({ type: [NoteSecuritySignalResponseDto] })
  items!: NoteSecuritySignalResponseDto[];

  @ApiProperty()
  total!: number;
}
