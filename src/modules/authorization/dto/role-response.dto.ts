import { UserType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: UserType })
  userType!: UserType;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: [String] })
  permissionKeys!: string[];
}

export class RolesListResponseDto {
  @ApiProperty({ type: [RoleResponseDto] })
  items!: RoleResponseDto[];
}
