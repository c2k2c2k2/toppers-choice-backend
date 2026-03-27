import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { ThrottleGuard } from '../../common/throttling/throttle.guard';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminSearchController } from './admin-search.controller';
import { PublicSearchController } from './public-search.controller';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [PrismaModule, SiteSettingsModule],
  controllers: [
    PublicSearchController,
    SearchController,
    AdminSearchController,
  ],
  providers: [SearchService, ThrottleGuard],
})
export class SearchModule {}
