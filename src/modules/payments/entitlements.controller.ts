import { Controller, Get } from '@nestjs/common';
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
import { EntitlementsService } from './entitlements.service';
import { EntitlementsListResponseDto } from './dto/payment-response.dto';

@ApiTags('entitlements')
@ApiBearerAuth('access-token')
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('me')
  @ApiOkResponse({ type: EntitlementsListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getCurrentEntitlements(@CurrentUser() user: AuthenticatedUser) {
    return this.entitlementsService.listCurrentUserEntitlements(user);
  }
}
