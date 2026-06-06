import { Prisma } from '@prisma/client';

export const userIdentitySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  siteId: true,
  email: true,
  phone: true,
  fullName: true,
  userType: true,
  status: true,
  lastLoginAt: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  profileImageFileAssetId: true,
  createdAt: true,
  updatedAt: true,
});

export const userAuthSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  siteId: true,
  email: true,
  phone: true,
  fullName: true,
  passwordHash: true,
  userType: true,
  status: true,
  lastLoginAt: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  profileImageFileAssetId: true,
  createdAt: true,
  updatedAt: true,
});

export type UserIdentityRecord = Prisma.UserGetPayload<{
  select: typeof userIdentitySelect;
}>;

export type UserAuthRecord = Prisma.UserGetPayload<{
  select: typeof userAuthSelect;
}>;

export function mapUserIdentity(user: UserIdentityRecord) {
  return {
    id: user.id,
    siteId: user.siteId,
    email: user.email,
    phone: user.phone,
    fullName: user.fullName,
    userType: user.userType,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    profileImageFileAssetId: user.profileImageFileAssetId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
