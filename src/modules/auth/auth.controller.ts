import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
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
import { ActionMessageResponseDto } from '../../common/dto/action-message-response.dto';
import { ApiErrorResponseDto } from '../../common/dto/api-error-response.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';
import {
  EmailOtpRequestDto,
  EmailOtpVerifyDto,
} from './dto/email-verification.dto';
import {
  AuthMeResponseDto,
  AuthResponseDto,
  AuthSessionsResponseDto,
  SignupResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordForgotDto } from './dto/password-forgot.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SignupDto } from './dto/signup.dto';
import { getRequestSessionMetadata } from './auth.utils';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @ApiCreatedResponse({ type: SignupResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async signup(@Body() body: SignupDto, @Req() request: Request) {
    return this.authService.signup(body, getRequestSessionMetadata(request));
  }

  @Public()
  @Post('email/otp')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActionMessageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async requestEmailOtp(
    @Body() body: EmailOtpRequestDto,
    @Req() request: Request,
  ) {
    return this.authService.requestEmailVerificationCode(
      body,
      getRequestSessionMetadata(request),
    );
  }

  @Public()
  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async verifyEmail(
    @Body() body: EmailOtpVerifyDto,
    @Req() request: Request,
  ) {
    return this.authService.verifyEmail(
      body,
      getRequestSessionMetadata(request),
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async login(@Body() body: LoginDto, @Req() request: Request) {
    return this.authService.login(body, getRequestSessionMetadata(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async refresh(@Body() body: RefreshDto, @Req() request: Request) {
    return this.authService.refresh(body, getRequestSessionMetadata(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: ActionMessageResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: AuthMeResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  @Get('sessions')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ type: AuthSessionsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSessions(user);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActionMessageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  async forgotPassword(
    @Body() body: PasswordForgotDto,
    @Req() request: Request,
  ) {
    return this.authService.requestPasswordReset(
      body,
      getRequestSessionMetadata(request),
    );
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ActionMessageResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async resetPassword(@Body() body: PasswordResetDto) {
    return this.authService.resetPassword(body);
  }
}
