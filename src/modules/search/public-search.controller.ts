import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '../../common/throttling/throttle.decorator';
import { ThrottleGuard } from '../../common/throttling/throttle.guard';
import { Public } from '../auth/decorators/public.decorator';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { SearchQueryDto, SearchResponseDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('public-search')
@Controller('search/public')
export class PublicSearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly siteSettingsService: SiteSettingsService,
  ) {}

  @Public()
  @Get()
  @UseGuards(ThrottleGuard)
  @Throttle(20, 60, 'search-public')
  @ApiOkResponse({ type: SearchResponseDto })
  async search(@Query() query: SearchQueryDto) {
    const site = await this.siteSettingsService.getRuntimeSnapshot();
    return this.searchService.searchPublic(site.site.id, query);
  }
}
