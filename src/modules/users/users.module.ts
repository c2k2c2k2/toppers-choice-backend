import { Module } from '@nestjs/common';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { PasswordHasherService } from '../auth/password-hasher.service';
import { AdminStudentsController } from './admin-students.controller';
import { AdminUserTypeGuard } from './admin-user-type.guard';
import { ProfileController } from './profile.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SiteSettingsModule],
  controllers: [ProfileController, AdminStudentsController],
  providers: [UsersService, AdminUserTypeGuard, PasswordHasherService],
  exports: [UsersService],
})
export class UsersModule {}
