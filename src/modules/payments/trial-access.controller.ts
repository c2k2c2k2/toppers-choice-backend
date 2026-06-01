import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TrialAccessResponseDto } from './dto/payment-response.dto';
import { TrialAccessService } from './trial-access.service';

@ApiTags('trial-access')
@ApiBearerAuth('access-token')
@Controller('trial')
export class TrialAccessController {
  constructor(private readonly trialAccessService: TrialAccessService) {}

  @Get('me')
  @ApiOkResponse({ type: TrialAccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getCurrentTrial(@CurrentUser() user: AuthenticatedUser) {
    return this.trialAccessService.getCurrentTrial(user);
  }

  @Post('start')
  @ApiOkResponse({ type: TrialAccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async startTrial(@CurrentUser() user: AuthenticatedUser) {
    return this.trialAccessService.startTrial(user);
  }

  @Post('heartbeat')
  @ApiOkResponse({ type: TrialAccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async heartbeat(@CurrentUser() user: AuthenticatedUser) {
    return this.trialAccessService.heartbeat(user);
  }

  @Post('stop')
  @ApiOkResponse({ type: TrialAccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async stopTrial(@CurrentUser() user: AuthenticatedUser) {
    return this.trialAccessService.stopTrial(user);
  }
}
