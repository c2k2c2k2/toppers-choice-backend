import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
} from '@prisma/client';

export class FeedbackAttachmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fileAssetId!: string;

  @ApiPropertyOptional({ nullable: true })
  label?: string | null;

  @ApiPropertyOptional({ nullable: true })
  originalFileName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  contentType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  status?: string | null;
}

export class FeedbackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: FeedbackCategory })
  category!: FeedbackCategory;

  @ApiProperty({ enum: FeedbackStatus })
  status!: FeedbackStatus;

  @ApiProperty({ enum: FeedbackPriority })
  priority!: FeedbackPriority;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional({ nullable: true })
  pageUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  pageTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  adminNote?: string | null;

  @ApiPropertyOptional({ nullable: true })
  userId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  userEmail?: string | null;

  @ApiProperty({ type: [FeedbackAttachmentResponseDto] })
  attachments!: FeedbackAttachmentResponseDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class FeedbackListResponseDto {
  @ApiProperty({ type: [FeedbackResponseDto] })
  items!: FeedbackResponseDto[];

  @ApiProperty()
  total!: number;
}
