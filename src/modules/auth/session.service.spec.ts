import { UnauthorizedException } from '@nestjs/common';
import { RefreshSessionStatus, UserStatus, UserType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthSettingsService } from './auth-settings.service';
import { AuthTokenService } from './auth-token.service';
import { SessionService } from './session.service';
import { UserIdentityRecord } from '../users/users.types';
import { hashOpaqueToken } from './auth.utils';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: {
    refreshSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let authTokenService: {
    issueAccessToken: jest.Mock;
    issueRefreshToken: jest.Mock;
    verifyRefreshToken: jest.Mock;
  };
  let authSettingsService: {
    getTokenSettings: jest.Mock;
  };

  const user: UserIdentityRecord = {
    id: 'user_1',
    siteId: 'site_1',
    email: 'student@example.com',
    fullName: 'Student Example',
    userType: UserType.STUDENT,
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    createdAt: new Date('2026-03-26T10:00:00.000Z'),
    updatedAt: new Date('2026-03-26T10:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      refreshSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
    };
    authTokenService = {
      issueAccessToken: jest.fn().mockResolvedValue('access-token'),
      issueRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
      verifyRefreshToken: jest.fn(),
    };
    authSettingsService = {
      getTokenSettings: jest.fn().mockResolvedValue({
        accessTokenTtlMinutes: 15,
        refreshTokenTtlDays: 30,
        passwordResetCodeTtlMinutes: 15,
        passwordResetMaxAttempts: 5,
      }),
    };

    service = new SessionService(
      prisma as unknown as PrismaService,
      authTokenService as unknown as AuthTokenService,
      authSettingsService as unknown as AuthSettingsService,
    );
  });

  it('creates a persisted refresh session with hashed token storage', async () => {
    const result = await service.createSession(user, {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(prisma.refreshSession.create).toHaveBeenCalledTimes(1);
    expect(prisma.refreshSession.create.mock.calls[0][0].data).toMatchObject({
      siteId: user.siteId,
      userId: user.id,
      tokenHash: hashOpaqueToken('refresh-token'),
      status: RefreshSessionStatus.ACTIVE,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });
    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.tokens.refreshToken).toBe('refresh-token');
    expect(result.tokens.sessionId).toBeTruthy();
  });

  it('rotates an active refresh session into a new session', async () => {
    authTokenService.verifyRefreshToken.mockResolvedValue({
      sub: user.id,
      siteId: user.siteId,
      sessionId: 'session_old',
      familyId: 'family_1',
      userType: user.userType,
      tokenType: 'refresh',
    });
    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'session_old',
      siteId: user.siteId,
      userId: user.id,
      familyId: 'family_1',
      tokenHash: hashOpaqueToken('refresh-token'),
      status: RefreshSessionStatus.ACTIVE,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      user,
    });

    const result = await service.rotateRefreshToken('refresh-token', {
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });

    expect(prisma.refreshSession.create).toHaveBeenCalledTimes(1);
    expect(prisma.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session_old' },
        data: expect.objectContaining({
          status: RefreshSessionStatus.ROTATED,
          replacedBySessionId: result.tokens.sessionId,
        }),
      }),
    );
    expect(result.tokens.sessionId).not.toBe('session_old');
  });

  it('revokes the active token family when a rotated refresh token is reused', async () => {
    authTokenService.verifyRefreshToken.mockResolvedValue({
      sub: user.id,
      siteId: user.siteId,
      sessionId: 'session_old',
      familyId: 'family_1',
      userType: user.userType,
      tokenType: 'refresh',
    });
    prisma.refreshSession.findUnique.mockResolvedValue({
      id: 'session_old',
      siteId: user.siteId,
      userId: user.id,
      familyId: 'family_1',
      tokenHash: hashOpaqueToken('refresh-token'),
      status: RefreshSessionStatus.ROTATED,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      user,
    });

    await expect(
      service.rotateRefreshToken('refresh-token', {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          familyId: 'family_1',
          status: RefreshSessionStatus.ACTIVE,
        },
        data: expect.objectContaining({
          status: RefreshSessionStatus.COMPROMISED,
          revokedReason: 'refresh_reuse_detected',
        }),
      }),
    );
  });
});
