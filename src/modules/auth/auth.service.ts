import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  TokenPurpose,
  UserStatus,
} from '@prisma/client';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { mapUserIdentity } from '../users/users.types';
import { AuthSettingsService } from './auth-settings.service';
import { PasswordForgotDto } from './dto/password-forgot.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';
import { PasswordHasherService } from './password-hasher.service';
import { SessionService } from './session.service';
import { AuthenticatedUser, RequestSessionMetadata } from './auth.types';
import { createOtpCode, hashOpaqueToken } from './auth.utils';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly sessionService: SessionService,
    private readonly authSettingsService: AuthSettingsService,
  ) {}

  async signup(body: SignupDto, metadata: RequestSessionMetadata) {
    const passwordHash = await this.passwordHasherService.hash(body.password);
    const user = await this.usersService.createStudentSelfSignup({
      email: body.email,
      fullName: body.fullName,
      passwordHash,
    });
    const activeUser = await this.usersService.markLastLogin(user.id);
    const session = await this.sessionService.createSession(activeUser, metadata);

    return {
      user: mapUserIdentity(activeUser),
      tokens: this.mapTokenBundle(session.tokens),
    };
  }

  async login(body: LoginDto, metadata: RequestSessionMetadata) {
    const user = await this.usersService.getAuthUserByEmail(body.email);
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    }

    this.assertUserCanAuthenticate(user.status);

    const passwordMatches = await this.passwordHasherService.verify(
      body.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    }

    const activeUser = await this.usersService.markLastLogin(user.id);
    const session = await this.sessionService.createSession(activeUser, metadata);

    return {
      user: mapUserIdentity(activeUser),
      tokens: this.mapTokenBundle(session.tokens),
    };
  }

  async refresh(body: RefreshDto, metadata: RequestSessionMetadata) {
    const session = await this.sessionService.rotateRefreshToken(
      body.refreshToken,
      metadata,
    );

    return {
      user: session.user,
      tokens: this.mapTokenBundle(session.tokens),
    };
  }

  async logout(user: AuthenticatedUser): Promise<ActionMessageResponseDto> {
    await this.sessionService.revokeSession(user.sessionId, 'logout');

    return {
      message: 'Logged out successfully.',
    };
  }

  async me(user: AuthenticatedUser) {
    const identity = await this.usersService.getIdentityById(user.userId);

    return {
      user: mapUserIdentity(identity),
      sessionId: user.sessionId,
    };
  }

  async getSessions(user: AuthenticatedUser) {
    const sessions = await this.sessionService.listUserSessions(
      user.userId,
      user.sessionId,
    );

    return {
      sessions,
    };
  }

  async requestPasswordReset(
    body: PasswordForgotDto,
    metadata: RequestSessionMetadata,
  ): Promise<ActionMessageResponseDto> {
    const site = await this.usersService.resolveCurrentSite();
    const normalizedEmail = this.usersService.normalizeEmail(body.email);
    const user = await this.prisma.user.findUnique({
      where: {
        siteId_email: {
          siteId: site.id,
          email: normalizedEmail,
        },
      },
      select: {
        id: true,
        siteId: true,
        email: true,
        status: true,
      },
    });

    if (user && user.status !== UserStatus.SUSPENDED) {
      const settings = await this.authSettingsService.getTokenSettings();
      const now = new Date();

      await this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          purpose: TokenPurpose.PASSWORD_RESET,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          invalidatedAt: now,
        },
      });

      const code = createOtpCode();
      const expiresAt = new Date(
        now.getTime() + settings.passwordResetCodeTtlMinutes * 60_000,
      );

      await this.prisma.passwordResetToken.create({
        data: {
          siteId: user.siteId,
          userId: user.id,
          email: user.email,
          purpose: TokenPurpose.PASSWORD_RESET,
          codeHash: hashOpaqueToken(code),
          expiresAt,
          requestedIp: metadata.ipAddress,
          requestedUserAgent: metadata.userAgent,
        },
      });
    }

    return {
      message:
        'If an account exists for that email, a password reset code has been issued.',
    };
  }

  async resetPassword(
    body: PasswordResetDto,
  ): Promise<ActionMessageResponseDto> {
    const site = await this.usersService.resolveCurrentSite();
    const normalizedEmail = this.usersService.normalizeEmail(body.email);
    const user = await this.prisma.user.findUnique({
      where: {
        siteId_email: {
          siteId: site.id,
          email: normalizedEmail,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'PASSWORD_RESET_CODE_INVALID',
        message: 'The password reset code is invalid or expired.',
      });
    }

    this.assertUserCanAuthenticate(user.status);

    const settings = await this.authSettingsService.getTokenSettings();
    const now = new Date();
    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        email: normalizedEmail,
        purpose: TokenPurpose.PASSWORD_RESET,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!resetToken) {
      throw new BadRequestException({
        code: 'PASSWORD_RESET_CODE_INVALID',
        message: 'The password reset code is invalid or expired.',
      });
    }

    if (resetToken.attemptCount >= settings.passwordResetMaxAttempts) {
      await this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          invalidatedAt: now,
          lastAttemptAt: now,
        },
      });

      throw new BadRequestException({
        code: 'PASSWORD_RESET_CODE_INVALID',
        message: 'The password reset code is invalid or expired.',
      });
    }

    const codeMatches = hashOpaqueToken(body.code) === resetToken.codeHash;
    if (!codeMatches) {
      const nextAttempts = resetToken.attemptCount + 1;
      await this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          attemptCount: {
            increment: 1,
          },
          lastAttemptAt: now,
          invalidatedAt:
            nextAttempts >= settings.passwordResetMaxAttempts ? now : undefined,
        },
      });

      throw new BadRequestException({
        code: 'PASSWORD_RESET_CODE_INVALID',
        message: 'The password reset code is invalid or expired.',
      });
    }

    const passwordHash = await this.passwordHasherService.hash(body.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          consumedAt: now,
          lastAttemptAt: now,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          purpose: TokenPurpose.PASSWORD_RESET,
          id: {
            not: resetToken.id,
          },
          consumedAt: null,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: now,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });
    });

    await this.sessionService.revokeUserSessions(user.id, 'password_reset');

    return {
      message: 'Password reset successfully.',
    };
  }

  private assertUserCanAuthenticate(status: UserStatus) {
    if (status === UserStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'USER_SUSPENDED',
        message: 'This account is suspended.',
      });
    }
  }

  private mapTokenBundle(tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
    sessionId: string;
  }) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString(),
      sessionId: tokens.sessionId,
    };
  }
}
