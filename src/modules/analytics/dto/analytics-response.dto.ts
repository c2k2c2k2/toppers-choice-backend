import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class StudentNotesAnalyticsDto {
  @ApiProperty()
  startedCount!: number;

  @ApiProperty()
  completedCount!: number;
}

class StudentPracticeAnalyticsDto {
  @ApiProperty()
  completedSessions!: number;

  @ApiProperty()
  answeredCount!: number;

  @ApiProperty()
  accuracyPercent!: number;
}

class StudentTestsAnalyticsDto {
  @ApiProperty()
  submittedAttempts!: number;

  @ApiProperty()
  bestPercentage!: number;
}

class StudentSubscriptionSummaryDto {
  @ApiPropertyOptional()
  subscriptionId!: string | null;

  @ApiPropertyOptional()
  planId!: string | null;

  @ApiPropertyOptional()
  planName!: string | null;

  @ApiPropertyOptional()
  endsAt!: Date | null;
}

export class StudentAnalyticsSummaryResponseDto {
  @ApiProperty({ type: StudentNotesAnalyticsDto })
  notes!: StudentNotesAnalyticsDto;

  @ApiProperty({ type: StudentPracticeAnalyticsDto })
  practice!: StudentPracticeAnalyticsDto;

  @ApiProperty({ type: StudentTestsAnalyticsDto })
  tests!: StudentTestsAnalyticsDto;

  @ApiProperty()
  unreadNotifications!: number;

  @ApiProperty()
  activeEntitlements!: number;

  @ApiProperty({ type: StudentSubscriptionSummaryDto })
  currentSubscription!: StudentSubscriptionSummaryDto;
}

class AdminUserMetricsDto {
  @ApiProperty()
  totalStudents!: number;

  @ApiProperty()
  activeStudents!: number;

  @ApiProperty()
  totalAdmins!: number;
}

class AdminContentMetricsDto {
  @ApiProperty()
  publishedPages!: number;

  @ApiProperty()
  publishedBanners!: number;

  @ApiProperty()
  publishedAnnouncements!: number;

  @ApiProperty()
  publishedSections!: number;

  @ApiProperty()
  publishedNotes!: number;

  @ApiProperty()
  publishedStructuredContent!: number;

  @ApiProperty()
  publishedQuestions!: number;

  @ApiProperty()
  publishedTests!: number;
}

class AdminRevenueMetricsDto {
  @ApiProperty()
  successfulOrders!: number;

  @ApiProperty()
  totalRevenuePaise!: number;

  @ApiProperty()
  activeSubscriptions!: number;
}

class AdminActivityMetricsDto {
  @ApiProperty()
  recentStudentSignups!: number;

  @ApiProperty()
  recentPracticeSessions!: number;

  @ApiProperty()
  recentTestAttempts!: number;

  @ApiProperty()
  recentPayments!: number;

  @ApiProperty()
  recentSecuritySignals!: number;

  @ApiProperty()
  sentBroadcasts!: number;
}

export class AdminAnalyticsOverviewResponseDto {
  @ApiProperty({ type: AdminUserMetricsDto })
  users!: AdminUserMetricsDto;

  @ApiProperty({ type: AdminContentMetricsDto })
  content!: AdminContentMetricsDto;

  @ApiProperty({ type: AdminRevenueMetricsDto })
  revenue!: AdminRevenueMetricsDto;

  @ApiProperty({ type: AdminActivityMetricsDto })
  activity!: AdminActivityMetricsDto;
}
