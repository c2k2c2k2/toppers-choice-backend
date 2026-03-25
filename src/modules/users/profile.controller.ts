import {
  Body,
  Controller,
  Get,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UserIdentityResponseDto } from './dto/user-identity-response.dto';
import { mapUserIdentity } from './users.types';
import { UsersService } from './users.service';

@ApiTags('profile')
@ApiBearerAuth('access-token')
@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: UserIdentityResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.usersService.getIdentityById(user.userId);

    return mapUserIdentity(profile);
  }

  @Patch('me')
  @ApiOkResponse({ type: UserIdentityResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateMyProfileDto,
  ) {
    const profile = await this.usersService.updateMyProfile(
      user.userId,
      body.fullName,
    );

    return mapUserIdentity(profile);
  }
}
