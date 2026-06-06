import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
} from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/\s+/gu, ' ');
}

export class FeedbackAttachmentInputDto {
  @ApiProperty({ example: 'cmag4file001' })
  @IsString()
  fileAssetId!: string;

  @ApiPropertyOptional({ example: 'Screenshot of the issue' })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class CreateFeedbackDto {
  @ApiProperty({ enum: FeedbackCategory })
  @IsEnum(FeedbackCategory)
  category!: FeedbackCategory;

  @ApiProperty({ example: 'Practice page timer issue' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MaxLength(160)
  subject!: string;

  @ApiProperty({
    example: 'The timer continued after I submitted my answer.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(3000)
  message!: string;

  @ApiPropertyOptional({ example: '/student/practice/session/abc123' })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageUrl?: string;

  @ApiPropertyOptional({ example: 'Practice session' })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  pageTitle?: string;

  @ApiPropertyOptional({ type: Object, example: { viewport: '390x844' } })
  @IsOptional()
  @IsObject()
  contextJson?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [FeedbackAttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique((item: FeedbackAttachmentInputDto) => item.fileAssetId)
  @ValidateNested({ each: true })
  @Type(() => FeedbackAttachmentInputDto)
  attachments?: FeedbackAttachmentInputDto[];
}

export class ListFeedbackQueryDto {
  @ApiPropertyOptional({ enum: FeedbackStatus })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @ApiPropertyOptional({ enum: FeedbackCategory })
  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;

  @ApiPropertyOptional({ enum: FeedbackPriority })
  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

export class UpdateFeedbackDto {
  @ApiPropertyOptional({ enum: FeedbackStatus })
  @IsOptional()
  @IsEnum(FeedbackStatus)
  status?: FeedbackStatus;

  @ApiPropertyOptional({ enum: FeedbackPriority })
  @IsOptional()
  @IsEnum(FeedbackPriority)
  priority?: FeedbackPriority;

  @ApiPropertyOptional({ example: 'Asked student for a screen recording.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;

  @ApiPropertyOptional({ example: 'cmag4admin001', nullable: true })
  @IsOptional()
  @IsString()
  assignedToUserId?: string | null;
}

export class UpdateMyFeedbackDto extends PartialType(CreateFeedbackDto) {}
