import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { Audit } from '../authorization/decorators/audit.decorator';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { AdminUsersListResponseDto } from './dto/admin-users-list-response.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserIdentityResponseDto } from './dto/user-identity-response.dto';
import { mapUserIdentity } from './users.types';
import { UsersService } from './users.service';

@ApiTags('admin-users')
@ApiBearerAuth('access-token')
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasherService: PasswordHasherService,
  ) {}

  @Get()
  @Policy('admin.users.read')
  @ApiOkResponse({ type: AdminUsersListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listUsers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAdminUsersQueryDto,
  ) {
    const result = await this.usersService.listUsersForAdmin(
      user.siteId,
      query,
    );

    return {
      items: result.items.map((item) => mapUserIdentity(item)),
      total: result.total,
    };
  }

  @Post('admins')
  @Policy('admin.users.manage')
  @Audit({
    action: 'admin.users.admins.create',
    resourceType: 'user',
    resourceIdResponseField: 'id',
    includeBodyKeys: ['fullName', 'email'],
  })
  @ApiCreatedResponse({ type: UserIdentityResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async createAdminUser(@Body() body: CreateAdminUserDto) {
    const passwordHash = await this.passwordHasherService.hash(body.password);
    const user = await this.usersService.createAdminUser({
      email: body.email,
      fullName: body.fullName,
      passwordHash,
    });

    return mapUserIdentity(user);
  }

  @Patch(':userId/status')
  @Policy('admin.users.manage')
  @Audit({
    action: 'admin.users.status.update',
    resourceType: 'user',
    resourceIdParam: 'userId',
    includeBodyKeys: ['status'],
  })
  @ApiOkResponse({ type: UserIdentityResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async updateUserStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: UpdateUserStatusDto,
  ) {
    const updatedUser = await this.usersService.updateUserStatus(
      userId,
      user.siteId,
      body.status,
    );

    return mapUserIdentity(updatedUser);
  }
}
