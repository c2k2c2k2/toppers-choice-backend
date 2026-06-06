import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenPurpose, UserStatus, UserType } from '@prisma/client';
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { MailService } from '../../infra/mail/mail.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { AuthorizationAccessSummary } from '../authorization/authorization.types';
import { UsersService } from '../users/users.service';
import { mapUserIdentity, UserAuthRecord } from '../users/users.types';
import { AuthSettingsService } from './auth-settings.service';
import {
  EmailOtpRequestDto,
  EmailOtpVerifyDto,
} from './dto/email-verification.dto';
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
    private readonly authorizationService: AuthorizationService,
    private readonly usersService: UsersService,
    private readonly passwordHasherService: PasswordHasherService,
    private readonly sessionService: SessionService,
    private readonly authSettingsService: AuthSettingsService,
    private readonly mailService: MailService,
  ) {}

  async signup(body: SignupDto, metadata: RequestSessionMetadata) {
    const passwordHash = await this.passwordHasherService.hash(body.password);
    const user = await this.usersService.createStudentSelfSignup({
      email: body.email,
      fullName: body.fullName,
      phone: body.phone,
      passwordHash,
    });
    await this.issueEmailVerificationCode(user.id, metadata);
    return {
      user: mapUserIdentity(user),
      email: user.email,
      resendAfterSeconds: 60,
      message: 'Verification code sent to your email.',
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
    this.assertEmailVerifiedForStudent(user);

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
    const session = await this.sessionService.createSession(
      activeUser,
      metadata,
    );
    const access = await this.authorizationService.getUserAccessSummary(
      activeUser.id,
      activeUser.siteId,
    );

    return {
      user: mapUserIdentity(activeUser),
      access: this.mapAccessSummary(access),
      tokens: this.mapTokenBundle(session.tokens),
    };
  }

  async refresh(body: RefreshDto, metadata: RequestSessionMetadata) {
    const session = await this.sessionService.rotateRefreshToken(
      body.refreshToken,
      metadata,
    );
    const access = await this.authorizationService.getUserAccessSummary(
      session.user.id,
      session.user.siteId,
    );

    return {
      user: session.user,
      access: this.mapAccessSummary(access),
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
    const access = await this.authorizationService.getUserAccessSummary(
      identity.id,
      identity.siteId,
    );

    return {
      user: mapUserIdentity(identity),
      sessionId: user.sessionId,
      access: this.mapAccessSummary(access),
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

      await this.mailService.sendBrandedMail({
        to: user.email,
        subject: "Reset your Toppers' Choice password",
        title: 'Reset your password',
        previewText: 'Use this code to reset your Toppers Choice password.',
        intro:
          'We received a request to reset the password for your account.',
        body: `This code is valid for ${settings.passwordResetCodeTtlMinutes} minutes. Never share it with anyone.`,
        otpCode: code,
        footerNote:
          'If you did not request a password reset, you can ignore this email and your password will stay unchanged.',
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

    const passwordHash = await this.passwordHasherService.hash(
      body.newPassword,
    );

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

    await this.mailService.sendBrandedMail({
      to: normalizedEmail,
      subject: "Your Toppers' Choice password was changed",
      title: 'Password changed successfully',
      previewText: 'Your Toppers Choice password was changed.',
      intro: 'Your account password was updated successfully.',
      body:
        'If this was you, no further action is needed. If this was not you, contact support immediately.',
      footerNote:
        'This security email was sent to help protect your learning account.',
    });

    return {
      message: 'Password reset successfully.',
    };
  }

  async requestEmailVerificationCode(
    body: EmailOtpRequestDto,
    metadata: RequestSessionMetadata,
  ): Promise<ActionMessageResponseDto & { resendAfterSeconds: number }> {
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
        emailVerifiedAt: true,
        status: true,
      },
    });

    if (user && !user.emailVerifiedAt && user.status !== UserStatus.SUSPENDED) {
      await this.issueEmailVerificationCode(user.id, metadata);
    }

    return {
      message:
        'If an unverified account exists for that email, a verification code has been sent.',
      resendAfterSeconds: 60,
    };
  }

  async verifyEmail(body: EmailOtpVerifyDto, metadata: RequestSessionMetadata) {
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
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_CODE_INVALID',
        message: 'The email verification code is invalid or expired.',
      });
    }

    this.assertUserCanAuthenticate(user.status);

    const settings = await this.authSettingsService.getEmailVerificationSettings();
    const now = new Date();
    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        email: normalizedEmail,
        purpose: TokenPurpose.EMAIL_VERIFICATION,
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

    if (!token) {
      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_CODE_INVALID',
        message: 'The email verification code is invalid or expired.',
      });
    }

    if (token.attemptCount >= settings.maxAttempts) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: {
          invalidatedAt: now,
          lastAttemptAt: now,
        },
      });

      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_CODE_INVALID',
        message: 'The email verification code is invalid or expired.',
      });
    }

    const codeMatches = hashOpaqueToken(body.code) === token.codeHash;
    if (!codeMatches) {
      const nextAttempts = token.attemptCount + 1;
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: {
          attemptCount: {
            increment: 1,
          },
          lastAttemptAt: now,
          invalidatedAt:
            nextAttempts >= settings.maxAttempts ? now : undefined,
        },
      });

      throw new BadRequestException({
        code: 'EMAIL_VERIFICATION_CODE_INVALID',
        message: 'The email verification code is invalid or expired.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: token.id },
        data: {
          consumedAt: now,
          lastAttemptAt: now,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          purpose: TokenPurpose.EMAIL_VERIFICATION,
          id: {
            not: token.id,
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
          emailVerifiedAt: user.emailVerifiedAt ?? now,
          status: UserStatus.ACTIVE,
        },
      });
    });

    const activeUser = await this.usersService.markLastLogin(user.id);
    const session = await this.sessionService.createSession(
      activeUser,
      metadata,
    );
    const access = await this.authorizationService.getUserAccessSummary(
      activeUser.id,
      activeUser.siteId,
    );

    await this.mailService.sendBrandedMail({
      to: activeUser.email,
      subject: "Welcome to Toppers' Choice",
      title: 'Your account is ready',
      previewText: 'Your Toppers Choice account has been verified.',
      intro: `Welcome ${activeUser.fullName}. Your email is verified and your learning dashboard is ready.`,
      body:
        'You can now continue to notes, practice, tests, plans, and guidance from your student dashboard.',
      footerNote:
        'Thank you for choosing Toppers Choice for serious exam preparation.',
    });

    return {
      user: mapUserIdentity(activeUser),
      access: this.mapAccessSummary(access),
      tokens: this.mapTokenBundle(session.tokens),
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

  private assertEmailVerifiedForStudent(
    user: Pick<UserAuthRecord, 'userType' | 'emailVerifiedAt'>,
  ) {
    if (user.userType === UserType.STUDENT && !user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Please verify your email before signing in.',
      });
    }
  }

  private async issueEmailVerificationCode(
    userId: string,
    metadata: RequestSessionMetadata,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        siteId: true,
        email: true,
        fullName: true,
      },
    });

    if (!user) {
      throw new BadRequestException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    const settings = await this.authSettingsService.getEmailVerificationSettings();
    const now = new Date();

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        purpose: TokenPurpose.EMAIL_VERIFICATION,
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
      now.getTime() + settings.codeTtlMinutes * 60_000,
    );

    await this.prisma.passwordResetToken.create({
      data: {
        siteId: user.siteId,
        userId: user.id,
        email: user.email,
        purpose: TokenPurpose.EMAIL_VERIFICATION,
        codeHash: hashOpaqueToken(code),
        expiresAt,
        requestedIp: metadata.ipAddress,
        requestedUserAgent: metadata.userAgent,
      },
    });

    await this.mailService.sendBrandedMail({
      to: user.email,
      subject: "Verify your Toppers' Choice email",
      title: 'Verify your email',
      previewText: 'Use this code to verify your Toppers Choice account.',
      intro: `Hi ${user.fullName}, enter this code to finish creating your student account.`,
      body: `This code is valid for ${settings.codeTtlMinutes} minutes. Keep it private.`,
      otpCode: code,
      footerNote:
        'This verification helps keep your learning account and future purchases secure.',
    });
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

  private mapAccessSummary(access: AuthorizationAccessSummary) {
    return {
      userId: access.userId,
      siteId: access.siteId,
      userType: access.userType,
      roles: access.roles,
      directOverrides: access.directOverrides.map((override) => ({
        permissionKey: override.permissionKey,
        isAllowed: override.isAllowed,
        reason: override.reason,
        updatedAt: override.updatedAt.toISOString(),
      })),
      effectivePermissionKeys: access.effectivePermissionKeys,
    };
  }
}
