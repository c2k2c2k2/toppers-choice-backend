import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { CmsService } from './cms.service';
import {
  CmsPageResponseDto,
  CmsResolveResponseDto,
} from './dto/cms-response.dto';

@ApiTags('public-cms')
@Controller('cms/public')
export class PublicCmsController {
  constructor(
    private readonly cmsService: CmsService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  @Public()
  @Get('resolve')
  @ApiOkResponse({ type: CmsResolveResponseDto })
  async resolvePublicCms() {
    const site = await this.siteSettingsService.getRuntimeSnapshot();
    return this.cmsService.resolvePublicCms(site.site.id);
  }

  @Public()
  @Get('pages/:slug')
  @ApiOkResponse({ type: CmsPageResponseDto })
  async getPublicPage(@Param('slug') slug: string) {
    const site = await this.siteSettingsService.getRuntimeSnapshot();
    return this.cmsService.getPublicPage(site.site.id, slug);
  }
}
