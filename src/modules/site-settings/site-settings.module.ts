import { Module } from '@nestjs/common';
import { SiteBootstrapController } from './site-bootstrap.controller';
import { SiteSettingsService } from './site-settings.service';

@Module({
  controllers: [SiteBootstrapController],
  providers: [SiteSettingsService],
  exports: [SiteSettingsService],
})
export class SiteSettingsModule {}
