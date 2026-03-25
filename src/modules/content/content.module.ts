import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminContentController } from './admin-content.controller';
import { ContentController } from './content.controller';
import { ContentEntitlementService } from './content.entitlement.service';
import { ContentService } from './content.service';
import { PublicContentController } from './public-content.controller';

@Module({
  imports: [AuthorizationModule, SiteSettingsModule],
  controllers: [
    AdminContentController,
    PublicContentController,
    ContentController,
  ],
  providers: [ContentEntitlementService, ContentService],
  exports: [ContentService],
})
export class ContentModule {}
