import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus, UserType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import {
  UserAuthRecord,
  UserIdentityRecord,
  userAuthSelect,
  userIdentitySelect,
} from './users.types';

type CreateStudentInput = {
  emailVerifiedAt?: Date | null;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  siteCode?: string;
};

type CreateUserInput = {
  emailVerifiedAt?: Date | null;
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  userType: UserType;
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
    return this.createStudentUser({
      ...input,
      emailVerifiedAt: null,
    });
  }

  async createStudentFromAdmin(
    input: CreateStudentInput,
  ): Promise<UserIdentityRecord> {
    return this.createStudentUser(input);
  }

  async createAdminUser(
    input: CreateStudentInput,
  ): Promise<UserIdentityRecord> {
    return this.createUser({
      ...input,
      userType: UserType.ADMIN,
    });
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

  normalizePhone(phone: string | undefined | null) {
    if (!phone) {
      return null;
    }

    return phone.trim().replace(/[\s()-]/gu, '');
  }

  async updateMyProfile(input: {
    userId: string;
    email?: string;
    fullName: string;
    phone?: string | null;
    profileImageFileAssetId?: string | null;
  }): Promise<UserIdentityRecord> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        email: true,
        siteId: true,
      },
    });

    if (!existingUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    if (input.profileImageFileAssetId) {
      await this.assertProfileImageAsset(input.userId, input.profileImageFileAssetId);
    }

    const normalizedEmail = input.email
      ? this.normalizeEmail(input.email)
      : undefined;
    const isEmailChanged =
      normalizedEmail !== undefined && normalizedEmail !== existingUser.email;

    if (isEmailChanged) {
      await this.assertEmailAvailable(existingUser.siteId, normalizedEmail);
    }

    return this.prisma.user.update({
      where: { id: input.userId },
      data: {
        email: isEmailChanged ? normalizedEmail : undefined,
        emailVerifiedAt: isEmailChanged ? null : undefined,
        fullName: input.fullName.trim(),
        phone:
          input.phone === undefined ? undefined : this.normalizePhone(input.phone),
        profileImageFileAssetId: input.profileImageFileAssetId,
      },
      select: userIdentitySelect,
    });
  }

  async listUsersForAdmin(siteId: string, query: ListAdminUsersQueryDto) {
    const search = query.q?.trim();
    const filters = {
      siteId,
      userType: query.userType,
      status: query.status,
      ...(search
        ? {
            OR: [
              {
                email: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                fullName: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: filters,
        orderBy: [{ createdAt: 'desc' }],
        take: query.limit ?? 25,
        select: userIdentitySelect,
      }),
      this.prisma.user.count({
        where: filters,
      }),
    ]);

    return {
      items,
      total,
    };
  }

  async updateUserStatus(
    userId: string,
    siteId: string,
    status: UserStatus,
  ): Promise<UserIdentityRecord> {
    await this.assertUserInSite(userId, siteId);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
      },
      select: userIdentitySelect,
    });
  }

  private async createStudentUser(
    input: CreateStudentInput,
  ): Promise<UserIdentityRecord> {
    return this.createUser({
      ...input,
      userType: UserType.STUDENT,
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

  private async assertUserInSite(userId: string, siteId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        siteId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }
  }

  private async createUser(
    input: CreateUserInput,
  ): Promise<UserIdentityRecord> {
    const site = await this.resolveCurrentSite(input.siteCode);
    const normalizedEmail = this.normalizeEmail(input.email);

    await this.assertEmailAvailable(site.id, normalizedEmail);

    return this.prisma.user.create({
      data: {
        siteId: site.id,
        email: normalizedEmail,
        emailVerifiedAt:
          input.emailVerifiedAt === undefined
            ? new Date()
            : input.emailVerifiedAt,
        phone: this.normalizePhone(input.phone),
        fullName: input.fullName.trim(),
        passwordHash: input.passwordHash,
        userType: input.userType,
        status: UserStatus.ACTIVE,
      },
      select: userIdentitySelect,
    });
  }

  private async assertProfileImageAsset(userId: string, fileAssetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        siteId: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: fileAssetId,
        siteId: user.siteId,
        purpose: 'PROFILE_IMAGE',
        status: 'READY',
      },
      select: {
        id: true,
      },
    });

    if (!asset) {
      throw new NotFoundException({
        code: 'PROFILE_IMAGE_NOT_FOUND',
        message: 'Profile image asset was not found.',
      });
    }
  }
}
