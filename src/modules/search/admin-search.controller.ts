import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '../../common/throttling/throttle.decorator';
import { ThrottleGuard } from '../../common/throttling/throttle.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Policy } from '../authorization/decorators/policy.decorator';
import { SearchQueryDto, SearchResponseDto } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('admin-search')
@ApiBearerAuth('access-token')
@Controller('admin/search')
export class AdminSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Policy('admin.search.read')
  @UseGuards(ThrottleGuard)
  @Throttle(120, 60, 'search-admin')
  @ApiOkResponse({ type: SearchResponseDto })
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchQueryDto,
  ) {
    return this.searchService.searchAdmin(user.siteId, query);
  }
}
