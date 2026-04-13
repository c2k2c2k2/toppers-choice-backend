import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminEnglishSpeakingController } from './admin-english-speaking.controller';
import { ElevenLabsTtsService } from './elevenlabs-tts.service';
import { EnglishSpeakingController } from './english-speaking.controller';
import { EnglishSpeakingEntitlementService } from './english-speaking.entitlement.service';
import { EnglishSpeakingService } from './english-speaking.service';
import { EnglishSpeakingSettingsService } from './english-speaking.settings.service';

@Module({
  imports: [PaymentsModule, SiteSettingsModule],
  controllers: [EnglishSpeakingController, AdminEnglishSpeakingController],
  providers: [
    EnglishSpeakingService,
    EnglishSpeakingSettingsService,
    EnglishSpeakingEntitlementService,
    ElevenLabsTtsService,
  ],
  exports: [EnglishSpeakingService],
})
export class EnglishSpeakingModule {}
