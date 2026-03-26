import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function normalizeQuery(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

export class SearchQueryDto {
  @ApiProperty({ example: 'guidance' })
  @Transform(({ value }) => normalizeQuery(value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q!: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SearchResultItemDto {
  @ApiProperty()
  resourceType!: string;

  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  slug!: string | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  subtitle!: string | null;

  @ApiPropertyOptional()
  status!: string | null;

  @ApiPropertyOptional()
  visibility!: string | null;
}

export class SearchResultGroupDto {
  @ApiProperty()
  resourceType!: string;

  @ApiProperty({ type: [SearchResultItemDto] })
  items!: SearchResultItemDto[];
}

export class SearchResponseDto {
  @ApiProperty()
  query!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty({ type: [SearchResultGroupDto] })
  groups!: SearchResultGroupDto[];
}
