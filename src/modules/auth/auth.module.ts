import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../../infra/mail/mail.module';
import { AuthorizationModule } from '../authorization/authorization.module';
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
  imports: [
    JwtModule.register({}),
    MailModule,
    SiteSettingsModule,
    UsersModule,
    AuthorizationModule,
  ],
  controllers: [AuthController],
  providers: [
    PasswordHasherService,
    AuthTokenService,
    AuthSettingsService,
    SessionService,
    AuthService,
    AccessTokenGuard,
  ],
  exports: [
    PasswordHasherService,
    AuthTokenService,
    SessionService,
    AccessTokenGuard,
  ],
})
export class AuthModule {}
