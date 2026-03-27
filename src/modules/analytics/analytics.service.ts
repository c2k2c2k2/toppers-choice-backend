import { Injectable } from '@nestjs/common';
import {
  ContentStatus,
  NoteStatus,
  NotificationMessageStatus,
  PaymentOrderStatus,
  QuestionStatus,
  SubscriptionStatus,
  TestAttemptStatus,
  TestStatus,
  UserStatus,
  UserType,
} from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudentSummary(user: AuthenticatedUser) {
    const now = new Date();
    const [
      noteProgress,
      practiceStats,
      testStats,
      unreadNotifications,
      entitlements,
      subscription,
    ] = await Promise.all([
      this.prisma.noteProgress.aggregate({
        where: {
          siteId: user.siteId,
          userId: user.userId,
        },
        _count: {
          noteId: true,
          completedAt: true,
        },
      }),
      this.prisma.practiceSession.aggregate({
        where: {
          siteId: user.siteId,
          userId: user.userId,
          status: 'COMPLETED',
        },
        _count: {
          id: true,
        },
        _sum: {
          answeredCount: true,
          correctCount: true,
        },
      }),
      this.prisma.testAttempt.aggregate({
        where: {
          siteId: user.siteId,
          userId: user.userId,
          status: {
            in: [TestAttemptStatus.SUBMITTED, TestAttemptStatus.AUTO_SUBMITTED],
          },
        },
        _count: {
          id: true,
        },
        _max: {
          percentage: true,
        },
      }),
      this.prisma.notificationMessage.count({
        where: {
          siteId: user.siteId,
          userId: user.userId,
          status: NotificationMessageStatus.DELIVERED,
          readAt: null,
        },
      }),
      this.prisma.entitlement.count({
        where: {
          siteId: user.siteId,
          userId: user.userId,
          revokedAt: null,
          startsAt: {
            lte: now,
          },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      }),
      this.prisma.subscription.findFirst({
        where: {
          siteId: user.siteId,
          userId: user.userId,
          status: SubscriptionStatus.ACTIVE,
          revokedAt: null,
          endsAt: {
            gt: now,
          },
        },
        orderBy: {
          endsAt: 'desc',
        },
        include: {
          plan: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const answeredCount = practiceStats._sum.answeredCount ?? 0;
    const correctCount = practiceStats._sum.correctCount ?? 0;

    return {
      notes: {
        startedCount: noteProgress._count.noteId,
        completedCount: noteProgress._count.completedAt,
      },
      practice: {
        completedSessions: practiceStats._count.id,
        answeredCount,
        accuracyPercent:
          answeredCount > 0
            ? Math.round((correctCount / answeredCount) * 100)
            : 0,
      },
      tests: {
        submittedAttempts: testStats._count.id,
        bestPercentage: testStats._max.percentage ?? 0,
      },
      unreadNotifications,
      activeEntitlements: entitlements,
      currentSubscription: {
        subscriptionId: subscription?.id ?? null,
        planId: subscription?.planId ?? null,
        planName: subscription?.plan.name ?? null,
        endsAt: subscription?.endsAt ?? null,
      },
    };
  }

  async getAdminOverview(siteId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      totalStudents,
      activeStudents,
      totalAdmins,
      publishedPages,
      publishedBanners,
      publishedAnnouncements,
      publishedSections,
      publishedNotes,
      publishedStructuredContent,
      publishedQuestions,
      publishedTests,
      paymentsAggregate,
      activeSubscriptions,
      recentStudentSignups,
      recentPracticeSessions,
      recentTestAttempts,
      recentPayments,
      recentSecuritySignals,
      sentBroadcasts,
    ] = await Promise.all([
      this.prisma.user.count({
        where: {
          siteId,
          userType: UserType.STUDENT,
        },
      }),
      this.prisma.user.count({
        where: {
          siteId,
          userType: UserType.STUDENT,
          status: UserStatus.ACTIVE,
        },
      }),
      this.prisma.user.count({
        where: {
          siteId,
          userType: UserType.ADMIN,
        },
      }),
      this.prisma.cmsPage.count({
        where: {
          siteId,
          status: 'PUBLISHED',
        },
      }),
      this.prisma.cmsBanner.count({
        where: {
          siteId,
          status: 'PUBLISHED',
        },
      }),
      this.prisma.cmsAnnouncement.count({
        where: {
          siteId,
          status: 'PUBLISHED',
        },
      }),
      this.prisma.cmsSection.count({
        where: {
          siteId,
          status: 'PUBLISHED',
        },
      }),
      this.prisma.note.count({
        where: {
          siteId,
          status: NoteStatus.PUBLISHED,
        },
      }),
      this.prisma.contentEntry.count({
        where: {
          siteId,
          status: ContentStatus.PUBLISHED,
        },
      }),
      this.prisma.question.count({
        where: {
          siteId,
          status: QuestionStatus.PUBLISHED,
        },
      }),
      this.prisma.test.count({
        where: {
          siteId,
          status: TestStatus.PUBLISHED,
        },
      }),
      this.prisma.paymentOrder.aggregate({
        where: {
          siteId,
          status: PaymentOrderStatus.SUCCEEDED,
        },
        _count: {
          id: true,
        },
        _sum: {
          amountPaise: true,
        },
      }),
      this.prisma.subscription.count({
        where: {
          siteId,
          status: SubscriptionStatus.ACTIVE,
          revokedAt: null,
          endsAt: {
            gt: new Date(),
          },
        },
      }),
      this.prisma.user.count({
        where: {
          siteId,
          userType: UserType.STUDENT,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      this.prisma.practiceSession.count({
        where: {
          siteId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      this.prisma.testAttempt.count({
        where: {
          siteId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      this.prisma.paymentOrder.count({
        where: {
          siteId,
          status: PaymentOrderStatus.SUCCEEDED,
          confirmedAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      this.prisma.noteSecuritySignal.count({
        where: {
          siteId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
      }),
      this.prisma.notificationBroadcast.count({
        where: {
          siteId,
          status: 'SENT',
        },
      }),
    ]);

    return {
      users: {
        totalStudents,
        activeStudents,
        totalAdmins,
      },
      content: {
        publishedPages,
        publishedBanners,
        publishedAnnouncements,
        publishedSections,
        publishedNotes,
        publishedStructuredContent,
        publishedQuestions,
        publishedTests,
      },
      revenue: {
        successfulOrders: paymentsAggregate._count.id,
        totalRevenuePaise: paymentsAggregate._sum.amountPaise ?? 0,
        activeSubscriptions,
      },
      activity: {
        recentStudentSignups,
        recentPracticeSessions,
        recentTestAttempts,
        recentPayments,
        recentSecuritySignals,
        sentBroadcasts,
      },
    };
  }
}
