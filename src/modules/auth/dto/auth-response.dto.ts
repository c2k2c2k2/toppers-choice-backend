import {
  RefreshSessionStatus,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserAccessResponseDto } from '../../authorization/dto/user-access-response.dto';
import { UserIdentityResponseDto } from '../../users/dto/user-identity-response.dto';

export class AuthTokenBundleResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: '2026-03-26T12:30:00.000Z' })
  accessTokenExpiresAt!: string;

  @ApiProperty({ example: '2026-04-25T12:15:00.000Z' })
  refreshTokenExpiresAt!: string;

  @ApiProperty()
  sessionId!: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: UserIdentityResponseDto })
  user!: UserIdentityResponseDto;

  @ApiProperty({ type: UserAccessResponseDto })
  access!: UserAccessResponseDto;

  @ApiProperty({ type: AuthTokenBundleResponseDto })
  tokens!: AuthTokenBundleResponseDto;
}

export class AuthMeResponseDto {
  @ApiProperty({ type: UserIdentityResponseDto })
  user!: UserIdentityResponseDto;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ type: UserAccessResponseDto })
  access!: UserAccessResponseDto;
}

export class RefreshSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: RefreshSessionStatus })
  status!: RefreshSessionStatus;

  @ApiProperty({ example: '2026-04-25T12:15:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: '2026-03-26T12:15:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-03-26T12:45:00.000Z', nullable: true })
  lastUsedAt?: string | null;

  @ApiPropertyOptional({ example: '127.0.0.1', nullable: true })
  ipAddress?: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0', nullable: true })
  userAgent?: string | null;

  @ApiProperty({ example: true })
  isCurrent!: boolean;
}

export class AuthSessionsResponseDto {
  @ApiProperty({ type: [RefreshSessionResponseDto] })
  sessions!: RefreshSessionResponseDto[];
}
