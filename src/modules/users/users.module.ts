import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminStudentsController } from './admin-students.controller';
import { ProfileController } from './profile.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SiteSettingsModule, AuthorizationModule],
  controllers: [
    ProfileController,
    AdminStudentsController,
    AdminUsersController,
  ],
  providers: [UsersService, PasswordHasherService],
  exports: [UsersService],
})
export class UsersModule {}
