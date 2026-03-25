import { UserType } from '@prisma/client';

export type PolicyRequirement = {
  adminOnly?: boolean;
  permissions?: string[];
  match?: 'all' | 'any';
  allowSelfUserIdParam?: string;
};

export type AuditMetadata = {
  action: string;
  resourceType: string;
  resourceIdParam?: string;
  resourceIdBodyField?: string;
  resourceIdResponseField?: string;
  includeBodyKeys?: string[];
  includeQuery?: boolean;
  includeParams?: boolean;
};

export type AuthorizationRoleSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  userType: UserType;
  isSystem: boolean;
  isActive: boolean;
  permissionKeys: string[];
};

export type AuthorizationPermissionOverrideSummary = {
  permissionKey: string;
  isAllowed: boolean;
  reason: string | null;
  updatedAt: Date;
};

export type AuthorizationAccessSummary = {
  userId: string;
  siteId: string;
  userType: UserType;
  roles: AuthorizationRoleSummary[];
  directOverrides: AuthorizationPermissionOverrideSummary[];
  effectivePermissionKeys: string[];
};
