import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  category!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
}

export class PermissionsListResponseDto {
  @ApiProperty({ type: [PermissionResponseDto] })
  items!: PermissionResponseDto[];
}
