import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { SiteSettingsModule } from '../site-settings/site-settings.module';
import { AdminTaxonomyController } from './admin-taxonomy.controller';
import { PublicCatalogController } from './public-catalog.controller';
import { TaxonomyService } from './taxonomy.service';

@Module({
  imports: [AuthorizationModule, SiteSettingsModule],
  controllers: [PublicCatalogController, AdminTaxonomyController],
  providers: [TaxonomyService],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
