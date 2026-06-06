import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../infra/idempotency/idempotency.module';
import { MailModule } from '../../infra/mail/mail.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminNotificationsController } from './admin-notifications.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, SiteSettingsModule, IdempotencyModule, MailModule],
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
