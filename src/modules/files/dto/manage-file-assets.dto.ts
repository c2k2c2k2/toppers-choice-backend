import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class InitFileUploadDto {
  @ApiProperty({ enum: FileAssetPurpose })
  @IsEnum(FileAssetPurpose)
  purpose!: FileAssetPurpose;

  @ApiProperty({
    example: 'mpsc-history-notes.pdf',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value,
  )
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(120)
  contentType!: string;

  @ApiProperty({ example: 5242880 })
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiPropertyOptional({ enum: FileAssetAccess })
  @IsOptional()
  @IsEnum(FileAssetAccess)
  accessLevel?: FileAssetAccess;

  @ApiPropertyOptional({
    example:
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(SHA256_PATTERN)
  checksumSha256?: string;
}

export class ListFileAssetsQueryDto {
  @ApiPropertyOptional({ enum: FileAssetPurpose })
  @IsOptional()
  @IsEnum(FileAssetPurpose)
  purpose?: FileAssetPurpose;

  @ApiPropertyOptional({ enum: FileAssetStatus })
  @IsOptional()
  @IsEnum(FileAssetStatus)
  status?: FileAssetStatus;

  @ApiPropertyOptional({ enum: FileAssetAccess })
  @IsOptional()
  @IsEnum(FileAssetAccess)
  accessLevel?: FileAssetAccess;
}
