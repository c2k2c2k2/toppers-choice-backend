import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Audit } from './decorators/audit.decorator';
import { Policy } from './decorators/policy.decorator';
import { AuthorizationService } from './authorization.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { PermissionsListResponseDto } from './dto/permission-response.dto';
import { RoleResponseDto, RolesListResponseDto } from './dto/role-response.dto';
import { SetUserAccessDto } from './dto/set-user-access.dto';
import { UserAccessResponseDto } from './dto/user-access-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('admin-access')
@ApiBearerAuth('access-token')
@Controller('admin')
export class AdminAccessController {
  constructor(
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get('access/permissions')
  @Policy('admin.roles.read')
  @ApiOkResponse({ type: PermissionsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listPermissions() {
    const permissions = await this.authorizationService.listPermissions();

    return {
      items: permissions.map((permission) => ({
        id: permission.id,
        key: permission.key,
        category: permission.category,
        description: permission.description,
      })),
    };
  }

  @Get('access/roles')
  @Policy('admin.roles.read')
  @ApiOkResponse({ type: RolesListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listRoles(@CurrentUser() user: AuthenticatedUser) {
    const roles = await this.authorizationService.listRoles(user.siteId);

    return {
      items: roles,
    };
  }

  @Post('access/roles')
  @Policy('admin.roles.manage')
  @Audit({
    action: 'admin.roles.create',
    resourceType: 'role',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['code', 'name', 'permissionKeys'],
  })
  @ApiCreatedResponse({ type: RoleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async createRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRoleDto,
  ) {
    return this.authorizationService.createRole(user.siteId, body);
  }

  @Patch('access/roles/:roleId')
  @Policy('admin.roles.manage')
  @Audit({
    action: 'admin.roles.update',
    resourceType: 'role',
    resourceIdParam: 'roleId',
    includeBodyKeys: ['code', 'name', 'permissionKeys', 'isActive'],
  })
  @ApiOkResponse({ type: RoleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('roleId') roleId: string,
    @Body() body: UpdateRoleDto,
  ) {
    return this.authorizationService.updateRole(user.siteId, roleId, body);
  }

  @Get('users/:userId/access')
  @Policy('admin.users.roles.read')
  @ApiOkResponse({ type: UserAccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.mapUserAccess(
      await this.authorizationService.getUserAccessSummary(userId, user.siteId),
    );
  }

  @Put('users/:userId/access')
  @Policy('admin.users.roles.manage')
  @Audit({
    action: 'admin.users.access.update',
    resourceType: 'user',
    resourceIdParam: 'userId',
    includeBodyKeys: ['roleIds', 'permissionOverrides'],
  })
  @ApiOkResponse({ type: UserAccessResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async setUserAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: SetUserAccessDto,
  ) {
    return this.mapUserAccess(
      await this.authorizationService.setUserAccess(
        userId,
        user.siteId,
        user.userId,
        body,
      ),
    );
  }

  private mapUserAccess(access: Awaited<ReturnType<AuthorizationService['getUserAccessSummary']>>) {
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
