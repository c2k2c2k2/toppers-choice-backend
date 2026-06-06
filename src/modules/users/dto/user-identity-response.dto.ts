import { UserStatus, UserType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserIdentityResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional({ example: '+919876543210', nullable: true })
  phone?: string | null;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: UserType })
  userType!: UserType;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional({ example: '2026-03-26T12:15:00.000Z', nullable: true })
  lastLoginAt?: string | null;

  @ApiPropertyOptional({ example: '2026-03-26T12:00:00.000Z', nullable: true })
  emailVerifiedAt?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  phoneVerifiedAt?: string | null;

  @ApiPropertyOptional({ example: 'cmag4file001', nullable: true })
  profileImageFileAssetId?: string | null;

  @ApiProperty({ example: '2026-03-26T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-26T12:15:00.000Z' })
  updatedAt!: string;
}
