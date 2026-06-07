import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentStatus,
  EnglishSpeakingAudioStatus,
  EnglishSpeakingLanguage,
} from '@prisma/client';

export enum StudentEnglishSpeakingTopicAccessMode {
  FULL = 'FULL',
  LOCKED = 'LOCKED',
}

export class EnglishSpeakingPdfAssetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  originalFileName!: string;

  @ApiProperty()
  contentType!: string;

  @ApiPropertyOptional({ nullable: true })
  sizeBytes!: number | null;

  @ApiProperty()
  protectedDeliveryPath!: string;
}

export class AdminEnglishSpeakingMaterialResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  notesFileAssetId!: string | null;

  @ApiPropertyOptional({
    type: EnglishSpeakingPdfAssetResponseDto,
    nullable: true,
  })
  notesPdf!: EnglishSpeakingPdfAssetResponseDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class StudentEnglishSpeakingMaterialResponseDto {
  @ApiPropertyOptional({
    type: EnglishSpeakingPdfAssetResponseDto,
    nullable: true,
  })
  notesPdf!: EnglishSpeakingPdfAssetResponseDto | null;
}

export class AdminEnglishSpeakingAudioStateResponseDto {
  @ApiProperty({ enum: EnglishSpeakingLanguage })
  language!: EnglishSpeakingLanguage;

  @ApiProperty({ enum: EnglishSpeakingAudioStatus })
  status!: EnglishSpeakingAudioStatus;

  @ApiProperty()
  hasPreview!: boolean;

  @ApiProperty()
  hasFinalized!: boolean;

  @ApiProperty()
  isCurrent!: boolean;

  @ApiPropertyOptional()
  previewStreamPath!: string | null;

  @ApiPropertyOptional()
  finalizedStreamPath!: string | null;

  @ApiPropertyOptional()
  voiceId!: string | null;

  @ApiPropertyOptional()
  modelId!: string | null;

  @ApiPropertyOptional()
  outputFormat!: string | null;

  @ApiPropertyOptional()
  lastError!: string | null;

  @ApiPropertyOptional()
  generatedAt!: Date | null;

  @ApiPropertyOptional()
  finalizedAt!: Date | null;
}

export class AdminEnglishSpeakingSentenceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  hindiText!: string;

  @ApiProperty()
  marathiText!: string;

  @ApiProperty()
  englishText!: string;

  @ApiProperty({ type: [AdminEnglishSpeakingAudioStateResponseDto] })
  audioStates!: AdminEnglishSpeakingAudioStateResponseDto[];
}

export class AdminEnglishSpeakingTopicSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: CatalogVisibility })
  visibility!: CatalogVisibility;

  @ApiProperty({ enum: ContentAccessType })
  accessType!: ContentAccessType;

  @ApiProperty({ enum: ContentStatus })
  status!: ContentStatus;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  sentenceCount!: number;

  @ApiProperty()
  readySentenceCount!: number;

  @ApiProperty()
  isReadyToPublish!: boolean;

  @ApiPropertyOptional()
  publishedAt!: Date | null;

  @ApiProperty()
  updatedAt!: Date;
}

export class AdminEnglishSpeakingTopicDetailResponseDto extends AdminEnglishSpeakingTopicSummaryResponseDto {
  @ApiProperty({ type: [AdminEnglishSpeakingSentenceResponseDto] })
  sentences!: AdminEnglishSpeakingSentenceResponseDto[];

  @ApiProperty()
  createdAt!: Date;
}

export class AdminEnglishSpeakingTopicListResponseDto {
  @ApiProperty({ type: [AdminEnglishSpeakingTopicSummaryResponseDto] })
  items!: AdminEnglishSpeakingTopicSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}

export class StudentEnglishSpeakingAudioTrackResponseDto {
  @ApiProperty({ enum: EnglishSpeakingLanguage })
  language!: EnglishSpeakingLanguage;

  @ApiProperty()
  streamPath!: string;
}

export class StudentEnglishSpeakingSentenceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  hindiText!: string;

  @ApiProperty()
  marathiText!: string;

  @ApiProperty()
  englishText!: string;

  @ApiProperty({ type: [StudentEnglishSpeakingAudioTrackResponseDto] })
  audioTracks!: StudentEnglishSpeakingAudioTrackResponseDto[];
}

export class StudentEnglishSpeakingTopicSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ enum: ContentAccessType })
  accessType!: ContentAccessType;

  @ApiProperty({ enum: StudentEnglishSpeakingTopicAccessMode })
  accessMode!: StudentEnglishSpeakingTopicAccessMode;

  @ApiProperty()
  sentenceCount!: number;

  @ApiPropertyOptional()
  publishedAt!: Date | null;

  @ApiProperty()
  updatedAt!: Date;
}

export class StudentEnglishSpeakingTopicDetailResponseDto extends StudentEnglishSpeakingTopicSummaryResponseDto {
  @ApiProperty({ type: [StudentEnglishSpeakingSentenceResponseDto] })
  sentences!: StudentEnglishSpeakingSentenceResponseDto[];
}

export class StudentEnglishSpeakingTopicListResponseDto {
  @ApiProperty({ type: [StudentEnglishSpeakingTopicSummaryResponseDto] })
  items!: StudentEnglishSpeakingTopicSummaryResponseDto[];

  @ApiProperty({ type: StudentEnglishSpeakingMaterialResponseDto })
  material!: StudentEnglishSpeakingMaterialResponseDto;

  @ApiProperty()
  total!: number;
}
