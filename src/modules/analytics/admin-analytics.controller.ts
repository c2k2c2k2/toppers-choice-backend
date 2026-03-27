import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Policy } from '../authorization/decorators/policy.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AnalyticsService } from './analytics.service';
import { AdminAnalyticsOverviewResponseDto } from './dto/analytics-response.dto';

@ApiTags('admin-analytics')
@ApiBearerAuth('access-token')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @Policy('analytics.read')
  @ApiOkResponse({ type: AdminAnalyticsOverviewResponseDto })
  async getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getAdminOverview(user.siteId);
  }
}
