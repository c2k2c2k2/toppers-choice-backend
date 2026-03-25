import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { PracticeController } from './practice.controller';
import { PracticeEntitlementService } from './practice.entitlement.service';
import { PracticeSettingsService } from './practice.settings.service';
import { PracticeService } from './practice.service';

@Module({
  imports: [PaymentsModule, SiteSettingsModule],
  controllers: [PracticeController],
  providers: [
    PracticeEntitlementService,
    PracticeSettingsService,
    PracticeService,
  ],
  exports: [PracticeService],
})
export class PracticeModule {}
