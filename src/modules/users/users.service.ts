import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus, UserType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import {
  UserAuthRecord,
  UserIdentityRecord,
  userAuthSelect,
  userIdentitySelect,
} from './users.types';

type CreateStudentInput = {
  fullName: string;
  email: string;
  passwordHash: string;
  siteCode?: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async resolveCurrentSite(siteCode?: string) {
    const snapshot = await this.siteSettingsService.getRuntimeSnapshot({
      siteCode,
    });

    return snapshot.site;
  }

  async getIdentityById(userId: string): Promise<UserIdentityRecord> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userIdentitySelect,
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    return user;
  }

  async getAuthUserByEmail(
    email: string,
    siteCode?: string,
  ): Promise<UserAuthRecord | null> {
    const site = await this.resolveCurrentSite(siteCode);

    return this.prisma.user.findUnique({
      where: {
        siteId_email: {
          siteId: site.id,
          email: this.normalizeEmail(email),
        },
      },
      select: userAuthSelect,
    });
  }

  async createStudentSelfSignup(
    input: CreateStudentInput,
  ): Promise<UserIdentityRecord> {
    return this.createStudentUser(input);
  }

  async createStudentFromAdmin(
    input: CreateStudentInput,
  ): Promise<UserIdentityRecord> {
    return this.createStudentUser(input);
  }

  async markLastLogin(userId: string): Promise<UserIdentityRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
      },
      select: userIdentitySelect,
    });
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<UserIdentityRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
      },
      select: userIdentitySelect,
    });
  }

  async updateMyProfile(
    userId: string,
    fullName: string,
  ): Promise<UserIdentityRecord> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName.trim(),
      },
      select: userIdentitySelect,
    });
  }

  private async createStudentUser(
    input: CreateStudentInput,
  ): Promise<UserIdentityRecord> {
    const site = await this.resolveCurrentSite(input.siteCode);
    const normalizedEmail = this.normalizeEmail(input.email);

    await this.assertEmailAvailable(site.id, normalizedEmail);

    return this.prisma.user.create({
      data: {
        siteId: site.id,
        email: normalizedEmail,
        fullName: input.fullName.trim(),
        passwordHash: input.passwordHash,
        userType: UserType.STUDENT,
        status: UserStatus.ACTIVE,
      },
      select: userIdentitySelect,
    });
  }

  private async assertEmailAvailable(siteId: string, email: string) {
    const existing = await this.prisma.user.findUnique({
      where: {
        siteId_email: {
          siteId,
          email,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'USER_EMAIL_ALREADY_EXISTS',
        message: 'A user with that email already exists.',
      });
    }
  }
}
