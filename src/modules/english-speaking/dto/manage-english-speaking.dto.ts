import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentStatus,
  EnglishSpeakingLanguage,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class UpsertEnglishSpeakingSentenceDto {
  @ApiPropertyOptional({
    example: 'cm9wq4l1s0004j1h9q2hb6h18',
    description: 'Provide an id when updating an existing sentence.',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiProperty({ example: 'आप कैसे हैं?' })
  @IsString()
  @MaxLength(2_000)
  hindiText!: string;

  @ApiProperty({ example: 'तुम्ही कसे आहात?' })
  @IsString()
  @MaxLength(2_000)
  marathiText!: string;

  @ApiProperty({ example: 'How are you?' })
  @IsString()
  @MaxLength(2_000)
  englishText!: string;
}

export class CreateEnglishSpeakingTopicDto {
  @ApiProperty({ example: 'Airport and flight' })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ example: 'airport-and-flight' })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @ApiPropertyOptional({
    example: 'Common travel conversation sentences for airports and flights.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  description?: string;

  @ApiPropertyOptional({
    enum: CatalogVisibility,
    default: CatalogVisibility.AUTHENTICATED,
  })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({
    enum: ContentAccessType,
    default: ContentAccessType.FREE,
  })
  @IsOptional()
  @IsEnum(ContentAccessType)
  accessType?: ContentAccessType;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ type: [UpsertEnglishSpeakingSentenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertEnglishSpeakingSentenceDto)
  sentences?: UpsertEnglishSpeakingSentenceDto[];
}

export class UpdateEnglishSpeakingTopicDto extends PartialType(
  CreateEnglishSpeakingTopicDto,
) {}

export class PublishEnglishSpeakingTopicDto {
  @ApiPropertyOptional({
    example: '2026-04-14T09:30:00.000Z',
    description:
      'Optional publish timestamp. Defaults to the current server time.',
  })
  @IsOptional()
  @IsDateString()
  publishAt?: string;
}

export class ListAdminEnglishSpeakingQueryDto {
  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ enum: ContentAccessType })
  @IsOptional()
  @IsEnum(ContentAccessType)
  accessType?: ContentAccessType;

  @ApiPropertyOptional({ enum: CatalogVisibility })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ example: 'airport' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class GenerateEnglishSpeakingAudioDto {
  @ApiPropertyOptional({
    enum: EnglishSpeakingLanguage,
    isArray: true,
    description:
      'When omitted, preview audio will be generated for all three languages.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsEnum(EnglishSpeakingLanguage, { each: true })
  languages?: EnglishSpeakingLanguage[];
}

export class FinalizeEnglishSpeakingAudioDto {
  @ApiPropertyOptional({
    enum: EnglishSpeakingLanguage,
    isArray: true,
    description:
      'When omitted, all currently generated preview tracks will be finalized.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsEnum(EnglishSpeakingLanguage, { each: true })
  languages?: EnglishSpeakingLanguage[];
}
