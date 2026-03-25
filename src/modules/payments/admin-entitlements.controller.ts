import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { EntitlementsService } from './entitlements.service';
import {
  GrantEntitlementDto,
  RevokeEntitlementDto,
} from './dto/manage-payments.dto';
import {
  EntitlementResponseDto,
  EntitlementsListResponseDto,
} from './dto/payment-response.dto';

@ApiTags('admin-entitlements')
@ApiBearerAuth('access-token')
@Controller('admin/entitlements')
export class AdminEntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('users/:userId')
  @Policy('payments.read')
  @ApiOkResponse({ type: EntitlementsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listUserEntitlements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.entitlementsService.listUserEntitlementsForAdmin(
      user.siteId,
      userId,
    );
  }

  @Post('grants')
  @Policy('payments.manage')
  @Audit({
    action: 'admin.entitlements.grant',
    resourceType: 'entitlement',
    includeBodyKeys: ['userId', 'planId', 'kind', 'startsAt', 'endsAt'],
  })
  @ApiCreatedResponse({ type: EntitlementsListResponseDto })
  async grantEntitlement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GrantEntitlementDto,
  ) {
    return this.entitlementsService.grantEntitlement(user, body);
  }

  @Post(':entitlementId/revoke')
  @Policy('payments.manage')
  @Audit({
    action: 'admin.entitlements.revoke',
    resourceType: 'entitlement',
    resourceIdParam: 'entitlementId',
    includeBodyKeys: ['reason'],
  })
  @ApiOkResponse({ type: EntitlementResponseDto })
  async revokeEntitlement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entitlementId') entitlementId: string,
    @Body() body: RevokeEntitlementDto,
  ) {
    return this.entitlementsService.revokeEntitlement(user, entitlementId, body);
  }
}
