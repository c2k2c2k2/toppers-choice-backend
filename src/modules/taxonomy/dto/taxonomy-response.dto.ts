import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogVisibility } from '@prisma/client';

class TaxonomyItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ example: 10 })
  orderIndex!: number;

  @ApiProperty({ enum: CatalogVisibility })
  visibility!: CatalogVisibility;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ExamTrackResponseDto extends TaxonomyItemResponseDto {
  @ApiPropertyOptional({ nullable: true })
  shortName!: string | null;

  @ApiPropertyOptional({ nullable: true })
  defaultMediumId!: string | null;
}

export class MediumResponseDto extends TaxonomyItemResponseDto {}

export class SubjectResponseDto extends TaxonomyItemResponseDto {
  @ApiProperty()
  examTrackId!: string;
}

export class TopicResponseDto extends TaxonomyItemResponseDto {
  @ApiProperty()
  subjectId!: string;

  @ApiPropertyOptional({ nullable: true })
  parentId!: string | null;
}

export class TopicTreeNodeResponseDto extends TopicResponseDto {
  @ApiProperty({ type: () => [TopicTreeNodeResponseDto] })
  children!: TopicTreeNodeResponseDto[];
}

export class TagResponseDto extends TaxonomyItemResponseDto {}

export class CatalogSubjectResponseDto extends SubjectResponseDto {
  @ApiProperty({ type: () => [TopicTreeNodeResponseDto] })
  topics!: TopicTreeNodeResponseDto[];
}

export class PublicCatalogResponseDto {
  @ApiProperty({ type: [ExamTrackResponseDto] })
  examTracks!: ExamTrackResponseDto[];

  @ApiProperty({ type: [MediumResponseDto] })
  mediums!: MediumResponseDto[];

  @ApiProperty({ type: [CatalogSubjectResponseDto] })
  subjects!: CatalogSubjectResponseDto[];

  @ApiProperty({ type: [TagResponseDto] })
  tags!: TagResponseDto[];
}
