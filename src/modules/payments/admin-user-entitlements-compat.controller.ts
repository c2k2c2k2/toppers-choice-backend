import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Policy } from '../authorization/decorators/policy.decorator';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsListResponseDto } from './dto/payment-response.dto';

@ApiTags('admin-entitlements')
@ApiBearerAuth('access-token')
@Controller('admin/users')
export class AdminUserEntitlementsCompatController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get(':userId/entitlements')
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
}
