import { UserType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleResponseDto } from './role-response.dto';

export class UserPermissionOverrideResponseDto {
  @ApiProperty()
  permissionKey!: string;

  @ApiProperty()
  isAllowed!: boolean;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;

  @ApiProperty({ example: '2026-03-26T10:15:00.000Z' })
  updatedAt!: string;
}

export class UserAccessResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty({ enum: UserType })
  userType!: UserType;

  @ApiProperty({ type: [RoleResponseDto] })
  roles!: RoleResponseDto[];

  @ApiProperty({ type: [UserPermissionOverrideResponseDto] })
  directOverrides!: UserPermissionOverrideResponseDto[];

  @ApiProperty({ type: [String] })
  effectivePermissionKeys!: string[];
}
