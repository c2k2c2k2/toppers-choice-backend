import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminCmsController } from './admin-cms.controller';
import { CmsController } from './cms.controller';
import { PublicCmsController } from './public-cms.controller';
import { CmsService } from './cms.service';

@Module({
  imports: [PrismaModule, SiteSettingsModule],
  controllers: [PublicCmsController, CmsController, AdminCmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
