import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AnalyticsService } from './analytics.service';
import { StudentAnalyticsSummaryResponseDto } from './dto/analytics-response.dto';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('me/summary')
  @ApiOkResponse({ type: StudentAnalyticsSummaryResponseDto })
  async getMySummary(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getStudentSummary(user);
  }
}
