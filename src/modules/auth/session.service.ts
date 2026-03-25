import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  RefreshSessionStatus,
  UserStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  mapUserIdentity,
  UserIdentityRecord,
  userIdentitySelect,
} from '../users/users.types';
import { AuthSettingsService } from './auth-settings.service';
import { AuthTokenService } from './auth-token.service';
import {
  RefreshSessionResponseDto,
} from './dto/auth-response.dto';
import { RequestSessionMetadata, TokenBundle } from './auth.types';
import { hashOpaqueToken } from './auth.utils';

type SessionIssueResult = {
  tokens: TokenBundle;
  user: ReturnType<typeof mapUserIdentity>;
};

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
    private readonly authSettingsService: AuthSettingsService,
  ) {}

  async createSession(
    user: UserIdentityRecord,
    metadata: RequestSessionMetadata,
  ): Promise<SessionIssueResult> {
    return this.issueSession(user, metadata);
  }

  async rotateRefreshToken(
    refreshToken: string,
    metadata: RequestSessionMetadata,
  ): Promise<SessionIssueResult> {
    const payload = await this.authTokenService.verifyRefreshToken(refreshToken);
    const now = new Date();
    const presentedTokenHash = hashOpaqueToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          select: userIdentitySelect,
        },
      },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.siteId !== payload.siteId ||
      session.tokenHash !== presentedTokenHash
    ) {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token is invalid or expired.',
      });
    }

    if (session.user.status === UserStatus.SUSPENDED) {
      await this.revokeSession(session.id, 'user_suspended');
      throw new ForbiddenException({
        code: 'USER_SUSPENDED',
        message: 'This account is suspended.',
      });
    }

    if (session.status !== RefreshSessionStatus.ACTIVE || session.revokedAt) {
      await this.revokeActiveFamilySessions(session.familyId, now);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REPLAY_DETECTED',
        message: 'Refresh token reuse was detected.',
      });
    }

    if (session.expiresAt <= now) {
      await this.revokeSession(session.id, 'expired');
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token is invalid or expired.',
      });
    }

    const nextSession = await this.issueSession(session.user, metadata, {
      familyId: session.familyId,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshSession.update({
        where: { id: session.id },
        data: {
          status: RefreshSessionStatus.ROTATED,
          revokedAt: now,
          revokedReason: 'rotated',
          lastUsedAt: now,
          replacedBySessionId: nextSession.tokens.sessionId,
        },
      });
    });

    return nextSession;
  }

  async revokeSession(sessionId: string, reason: string) {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!session || session.status !== RefreshSessionStatus.ACTIVE) {
      return;
    }

    await this.prisma.refreshSession.update({
      where: { id: sessionId },
      data: {
        status: RefreshSessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  async revokeUserSessions(userId: string, reason: string) {
    await this.prisma.refreshSession.updateMany({
      where: {
        userId,
        status: RefreshSessionStatus.ACTIVE,
      },
      data: {
        status: RefreshSessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  async listUserSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<RefreshSessionResponseDto[]> {
    const sessions = await this.prisma.refreshSession.findMany({
      where: {
        userId,
        status: RefreshSessionStatus.ACTIVE,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isCurrent: session.id === currentSessionId,
    }));
  }

  private async issueSession(
    user: UserIdentityRecord,
    metadata: RequestSessionMetadata,
    options?: {
      familyId?: string;
    },
  ): Promise<SessionIssueResult> {
    const settings = await this.authSettingsService.getTokenSettings();
    const sessionId = randomUUID();
    const familyId = options?.familyId ?? randomUUID();
    const now = new Date();
    const accessTokenExpiresAt = new Date(
      now.getTime() + settings.accessTokenTtlMinutes * 60_000,
    );
    const refreshTokenExpiresAt = new Date(
      now.getTime() + settings.refreshTokenTtlDays * 86_400_000,
    );
    const [accessToken, refreshToken] = await Promise.all([
      this.authTokenService.issueAccessToken(
        {
          sub: user.id,
          siteId: user.siteId,
          sessionId,
          userType: user.userType,
        },
        settings.accessTokenTtlMinutes,
      ),
      this.authTokenService.issueRefreshToken(
        {
          sub: user.id,
          siteId: user.siteId,
          sessionId,
          familyId,
          userType: user.userType,
        },
        settings.refreshTokenTtlDays,
      ),
    ]);

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        siteId: user.siteId,
        userId: user.id,
        familyId,
        tokenHash: hashOpaqueToken(refreshToken),
        status: RefreshSessionStatus.ACTIVE,
        expiresAt: refreshTokenExpiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    return {
      user: mapUserIdentity(user),
      tokens: {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        sessionId,
      },
    };
  }

  private async revokeActiveFamilySessions(familyId: string, now: Date) {
    await this.prisma.refreshSession.updateMany({
      where: {
        familyId,
        status: RefreshSessionStatus.ACTIVE,
      },
      data: {
        status: RefreshSessionStatus.COMPROMISED,
        revokedAt: now,
        revokedReason: 'refresh_reuse_detected',
      },
    });
  }
}
