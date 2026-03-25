import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { UsersModule } from '../users/users.module';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSettingsService } from './auth-settings.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordHasherService } from './password-hasher.service';
import { SessionService } from './session.service';

@Module({
  imports: [JwtModule.register({}), SiteSettingsModule, UsersModule],
  controllers: [AuthController],
  providers: [
    PasswordHasherService,
    AuthTokenService,
    AuthSettingsService,
    SessionService,
    AuthService,
    AccessTokenGuard,
    {
      provide: APP_GUARD,
      useExisting: AccessTokenGuard,
    },
  ],
  exports: [PasswordHasherService, AuthTokenService, SessionService],
})
export class AuthModule {}
