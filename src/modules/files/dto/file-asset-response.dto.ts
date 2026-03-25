import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
} from '@prisma/client';

export class FileAssetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty({ enum: FileAssetPurpose })
  purpose!: FileAssetPurpose;

  @ApiProperty({ enum: FileAssetAccess })
  accessLevel!: FileAssetAccess;

  @ApiProperty({ enum: FileAssetStatus })
  status!: FileAssetStatus;

  @ApiProperty()
  objectKey!: string;

  @ApiProperty()
  originalFileName!: string;

  @ApiPropertyOptional({ nullable: true })
  extension!: string | null;

  @ApiProperty()
  contentType!: string;

  @ApiPropertyOptional({ nullable: true })
  declaredSizeBytes!: number | null;

  @ApiPropertyOptional({ nullable: true })
  sizeBytes!: number | null;

  @ApiPropertyOptional({ nullable: true })
  checksumSha256!: string | null;

  @ApiPropertyOptional({ nullable: true })
  etag!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageWidth!: number | null;

  @ApiPropertyOptional({ nullable: true })
  imageHeight!: number | null;

  @ApiProperty()
  createdByUserId!: string;

  @ApiPropertyOptional({ nullable: true })
  confirmedByUserId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  uploadExpiresAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  publicDeliveryPath!: string;

  @ApiProperty()
  protectedDeliveryPath!: string;
}

export class InitFileUploadResponseDto {
  @ApiProperty({ type: FileAssetResponseDto })
  fileAsset!: FileAssetResponseDto;

  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty({ example: 'PUT' })
  uploadMethod!: 'PUT';

  @ApiProperty({ type: Object, additionalProperties: { type: 'string' } })
  requiredHeaders!: Record<string, string>;
}

export class FileAssetListResponseDto {
  @ApiProperty({ type: [FileAssetResponseDto] })
  items!: FileAssetResponseDto[];

  @ApiProperty({ example: 12 })
  total!: number;
}
