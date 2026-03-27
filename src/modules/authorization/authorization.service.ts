import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SELF_ROLE_MANAGEMENT_PERMISSION } from './authorization.constants';
import {
  AuthorizationAccessSummary,
  AuthorizationPermissionOverrideSummary,
  AuthorizationRoleSummary,
  PolicyRequirement,
} from './authorization.types';
import { CreateRoleDto } from './dto/create-role.dto';
import { SetUserAccessDto } from './dto/set-user-access.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async listRoles(siteId: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        siteId,
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return roles.map((role) => this.mapRoleSummary(role));
  }

  async createRole(siteId: string, input: CreateRoleDto) {
    const permissionIds = await this.resolvePermissionIds(input.permissionKeys);
    const role = await this.prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          siteId,
          code: input.code,
          name: input.name.trim(),
          description: input.description?.trim() || null,
        },
      });

      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: createdRole.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return createdRole.id;
    });

    return this.getRoleSummaryById(role);
  }

  async updateRole(siteId: string, roleId: string, input: UpdateRoleDto) {
    const existingRole = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        siteId,
      },
      select: {
        id: true,
        isSystem: true,
      },
    });

    if (!existingRole) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role was not found.',
      });
    }

    if (existingRole.isSystem && input.code && input.code !== undefined) {
      throw new BadRequestException({
        code: 'SYSTEM_ROLE_CODE_LOCKED',
        message: 'System role codes cannot be changed.',
      });
    }

    const permissionIds =
      input.permissionKeys !== undefined
        ? await this.resolvePermissionIds(input.permissionKeys)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: {
          id: roleId,
        },
        data: {
          code: input.code,
          name: input.name?.trim(),
          description:
            input.description === undefined
              ? undefined
              : input.description?.trim() || null,
          isActive: input.isActive,
        },
      });

      if (permissionIds) {
        await tx.rolePermission.deleteMany({
          where: {
            roleId,
          },
        });

        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId,
              permissionId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    return this.getRoleSummaryById(roleId);
  }

  async getUserAccessSummary(
    userId: string,
    siteId: string,
  ): Promise<AuthorizationAccessSummary> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        siteId,
      },
      select: {
        id: true,
        siteId: true,
        userType: true,
        userRoles: {
          select: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissionOverrides: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    const roles = user.userRoles
      .map(({ role }) => this.mapRoleSummary(role))
      .sort((left, right) => left.name.localeCompare(right.name));
    const directOverrides = user.permissionOverrides
      .map<AuthorizationPermissionOverrideSummary>((override) => ({
        permissionKey: override.permission.key,
        isAllowed: override.isAllowed,
        reason: override.reason,
        updatedAt: override.updatedAt,
      }))
      .sort((left, right) =>
        left.permissionKey.localeCompare(right.permissionKey),
      );

    const effectivePermissionKeys = this.computeEffectivePermissions(
      roles,
      directOverrides,
    );

    return {
      userId: user.id,
      siteId: user.siteId,
      userType: user.userType,
      roles,
      directOverrides,
      effectivePermissionKeys,
    };
  }

  async setUserAccess(
    targetUserId: string,
    siteId: string,
    actorUserId: string,
    input: SetUserAccessDto,
  ) {
    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        siteId,
      },
      select: {
        id: true,
        userType: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User was not found.',
      });
    }

    const normalizedRoleIds = Array.from(new Set(input.roleIds));
    const roles = normalizedRoleIds.length
      ? await this.prisma.role.findMany({
          where: {
            id: {
              in: normalizedRoleIds,
            },
            siteId,
          },
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        })
      : [];

    if (roles.length !== normalizedRoleIds.length) {
      throw new BadRequestException({
        code: 'INVALID_ROLE_IDS',
        message: 'One or more role ids are invalid for the current site.',
      });
    }

    const mismatchedRole = roles.find(
      (role) => role.userType !== targetUser.userType,
    );
    if (mismatchedRole) {
      throw new BadRequestException({
        code: 'ROLE_USER_TYPE_MISMATCH',
        message: 'Assigned roles must match the target user type.',
      });
    }

    const permissionOverridesInput = input.permissionOverrides ?? [];
    const permissionIdsByKey = permissionOverridesInput.length
      ? await this.resolvePermissionMap(
          permissionOverridesInput.map(({ permissionKey }) => permissionKey),
        )
      : new Map<string, string>();

    if (actorUserId === targetUserId) {
      const nextEffectivePermissions = this.computeEffectivePermissions(
        roles.map((role) => this.mapRoleSummary(role)),
        permissionOverridesInput.map((override) => ({
          permissionKey: override.permissionKey,
          isAllowed: override.isAllowed,
          reason: override.reason ?? null,
          updatedAt: new Date(),
        })),
      );

      if (!nextEffectivePermissions.includes(SELF_ROLE_MANAGEMENT_PERMISSION)) {
        throw new ForbiddenException({
          code: 'CANNOT_REMOVE_OWN_ACCESS_MANAGEMENT',
          message:
            'You cannot remove your own role-management access in the same request.',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: {
          userId: targetUserId,
          roleId: {
            notIn: normalizedRoleIds.length > 0 ? normalizedRoleIds : [''],
          },
        },
      });

      if (normalizedRoleIds.length === 0) {
        await tx.userRole.deleteMany({
          where: {
            userId: targetUserId,
          },
        });
      } else {
        await tx.userRole.createMany({
          data: normalizedRoleIds.map((roleId) => ({
            userId: targetUserId,
            roleId,
            assignedByUserId: actorUserId,
          })),
          skipDuplicates: true,
        });
      }

      const permissionIds = Array.from(permissionIdsByKey.values());
      await tx.userPermissionOverride.deleteMany({
        where: {
          userId: targetUserId,
          permissionId: {
            notIn: permissionIds.length > 0 ? permissionIds : [''],
          },
        },
      });

      if (permissionIds.length === 0) {
        await tx.userPermissionOverride.deleteMany({
          where: {
            userId: targetUserId,
          },
        });
      } else {
        for (const override of permissionOverridesInput) {
          const permissionId = permissionIdsByKey.get(override.permissionKey);
          if (!permissionId) {
            continue;
          }

          await tx.userPermissionOverride.upsert({
            where: {
              userId_permissionId: {
                userId: targetUserId,
                permissionId,
              },
            },
            update: {
              isAllowed: override.isAllowed,
              reason: override.reason?.trim() || null,
              assignedByUserId: actorUserId,
            },
            create: {
              userId: targetUserId,
              permissionId,
              isAllowed: override.isAllowed,
              reason: override.reason?.trim() || null,
              assignedByUserId: actorUserId,
            },
          });
        }
      }
    });

    return this.getUserAccessSummary(targetUserId, siteId);
  }

  async evaluatePolicy(
    siteId: string,
    userId: string,
    policy: PolicyRequirement,
  ) {
    const accessSummary = await this.getUserAccessSummary(userId, siteId);
    const requiredPermissions = policy.permissions ?? [];
    const match = policy.match ?? 'all';
    const missingPermissions = requiredPermissions.filter(
      (permissionKey) =>
        !accessSummary.effectivePermissionKeys.includes(permissionKey),
    );

    return {
      accessSummary,
      allowed:
        requiredPermissions.length === 0
          ? true
          : match === 'any'
            ? missingPermissions.length < requiredPermissions.length
            : missingPermissions.length === 0,
      missingPermissions,
    };
  }

  private async resolvePermissionIds(permissionKeys: string[]) {
    const permissionMap = await this.resolvePermissionMap(permissionKeys);
    return permissionKeys.map(
      (permissionKey) => permissionMap.get(permissionKey)!,
    );
  }

  private async resolvePermissionMap(permissionKeys: string[]) {
    const uniqueKeys = Array.from(new Set(permissionKeys));
    const permissions = await this.prisma.permission.findMany({
      where: {
        key: {
          in: uniqueKeys,
        },
      },
      select: {
        id: true,
        key: true,
      },
    });

    if (permissions.length !== uniqueKeys.length) {
      const foundKeys = new Set(permissions.map(({ key }) => key));
      const missingKeys = uniqueKeys.filter((key) => !foundKeys.has(key));
      throw new BadRequestException({
        code: 'UNKNOWN_PERMISSION_KEYS',
        message: `Unknown permission keys: ${missingKeys.join(', ')}`,
      });
    }

    return new Map(
      permissions.map((permission) => [permission.key, permission.id]),
    );
  }

  private async getRoleSummaryById(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: {
        id: roleId,
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role was not found.',
      });
    }

    return this.mapRoleSummary(role);
  }

  private mapRoleSummary(role: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    userType: import('@prisma/client').UserType;
    isSystem: boolean;
    isActive: boolean;
    rolePermissions: Array<{
      permission: {
        key: string;
      };
    }>;
  }): AuthorizationRoleSummary {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      userType: role.userType,
      isSystem: role.isSystem,
      isActive: role.isActive,
      permissionKeys: role.rolePermissions
        .map(({ permission }) => permission.key)
        .sort((left, right) => left.localeCompare(right)),
    };
  }

  private computeEffectivePermissions(
    roles: AuthorizationRoleSummary[],
    directOverrides: AuthorizationPermissionOverrideSummary[],
  ) {
    const effectivePermissions = new Set<string>();

    for (const role of roles) {
      if (!role.isActive) {
        continue;
      }

      for (const permissionKey of role.permissionKeys) {
        effectivePermissions.add(permissionKey);
      }
    }

    for (const override of directOverrides) {
      if (override.isAllowed) {
        effectivePermissions.add(override.permissionKey);
      } else {
        effectivePermissions.delete(override.permissionKey);
      }
    }

    return Array.from(effectivePermissions).sort((left, right) =>
      left.localeCompare(right),
    );
  }
}
