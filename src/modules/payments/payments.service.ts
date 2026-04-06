import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntitlementSourceType,
  PaymentEventSource,
  PaymentEventStatus,
  PaymentOrderStatus,
  PaymentProvider,
  Prisma,
  SubscriptionStatus,
  UserType,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { IdempotencyService } from '../../infra/idempotency/idempotency.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { EntitlementsService } from './entitlements.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentSettingsService } from './payment-settings.service';
import { PlansService } from './plans.service';
import {
  isTerminalPaymentStatus,
  mapPaymentOrder,
  paymentOrderSelect,
  planDetailSelect,
  type PaymentOrderRecord,
} from './payments.types';
import type {
  CreateCheckoutDto,
  ListAdminPaymentOrdersQueryDto,
} from './dto/manage-payments.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly paymentSettingsService: PaymentSettingsService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly entitlementsService: EntitlementsService,
    private readonly siteSettingsService: SiteSettingsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async createCheckout(
    user: AuthenticatedUser,
    input: CreateCheckoutDto,
    idempotencyKey?: string | null,
  ) {
    this.assertStudentUser(user);

    return this.idempotencyService.execute(
      {
        siteId: user.siteId,
        userId: user.userId,
        scope: 'payments.checkout',
        key: idempotencyKey,
        requestBody: input,
        resourceType: 'payment_order',
        ttlMinutes: 120,
      },
      async () => this.createCheckoutInternal(user, input),
    );
  }

  private async createCheckoutInternal(
    user: AuthenticatedUser,
    input: CreateCheckoutDto,
  ) {
    this.assertStudentUser(user);

    const plan = await this.plansService.getActivePlanByCheckoutInput(
      user.siteId,
      input,
    );

    if (plan.pricePaise <= 0) {
      throw new BadRequestException({
        code: 'PLAN_PRICE_INVALID',
        message: 'Checkout is only supported for paid plans.',
      });
    }

    const [provider, orderExpiryMinutes] = await Promise.all([
      this.paymentSettingsService.getActiveProvider(),
      this.paymentSettingsService.getOrderExpiryMinutes(),
    ]);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + orderExpiryMinutes * 60_000);
    const merchantOrderCode = this.buildMerchantOrderCode();

    const createdOrder = await this.prisma.paymentOrder.create({
      data: {
        siteId: user.siteId,
        userId: user.userId,
        planId: plan.id,
        provider,
        merchantOrderCode,
        amountPaise: plan.pricePaise,
        currencyCode: plan.currencyCode,
        expiresAt,
        metadataJson: {
          checkoutSource: 'student',
        } satisfies Prisma.JsonObject,
      },
      select: {
        id: true,
        merchantOrderCode: true,
        amountPaise: true,
        currencyCode: true,
      },
    });

    let providerResponse;

    try {
      providerResponse = await this.paymentGatewayService.initiateCheckout(
        provider,
        {
          order: createdOrder,
          purchaser: {
            id: user.userId,
            email: user.email,
            fullName: user.fullName,
          },
        },
      );
    } catch (error) {
      await this.recordCheckoutInitiationFailure({
        siteId: user.siteId,
        provider,
        order: createdOrder,
        error,
      });

      throw error;
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          siteId: user.siteId,
          paymentOrderId: createdOrder.id,
          provider,
          source: PaymentEventSource.CHECKOUT_RESPONSE,
          eventType: 'CHECKOUT_INITIATED',
          dedupeKey: `checkout:${createdOrder.merchantOrderCode}`,
          status: PaymentEventStatus.PROCESSED,
          payloadJson: providerResponse.metadataJson as Prisma.InputJsonValue,
          processedAt: new Date(),
        },
      });

      await tx.paymentTransaction.upsert({
        where: {
          paymentOrderId: createdOrder.id,
        },
        update: {
          provider,
          providerTransactionId: null,
          providerReferenceId: providerResponse.providerReferenceId,
          status:
            providerResponse.status === PaymentOrderStatus.SUCCEEDED
              ? 'SUCCEEDED'
              : 'INITIATED',
          amountPaise: createdOrder.amountPaise,
          currencyCode: createdOrder.currencyCode,
          occurredAt: new Date(),
          responseJson: providerResponse.metadataJson as Prisma.InputJsonValue,
        },
        create: {
          siteId: user.siteId,
          paymentOrderId: createdOrder.id,
          provider,
          providerReferenceId: providerResponse.providerReferenceId,
          status:
            providerResponse.status === PaymentOrderStatus.SUCCEEDED
              ? 'SUCCEEDED'
              : 'INITIATED',
          amountPaise: createdOrder.amountPaise,
          currencyCode: createdOrder.currencyCode,
          occurredAt: new Date(),
          responseJson: providerResponse.metadataJson as Prisma.InputJsonValue,
        },
      });

      return tx.paymentOrder.update({
        where: {
          id: createdOrder.id,
        },
        data: {
          status: providerResponse.status,
          redirectUrl: providerResponse.redirectUrl,
          providerOrderId: providerResponse.providerOrderId,
          providerReferenceId: providerResponse.providerReferenceId,
          providerStatus: providerResponse.providerStatus,
          metadataJson: providerResponse.metadataJson as Prisma.InputJsonValue,
        },
        select: paymentOrderSelect,
      });
    });

    if (
      updatedOrder.status === PaymentOrderStatus.SUCCEEDED &&
      !updatedOrder.subscription
    ) {
      return mapPaymentOrder(
        await this.activateSuccessfulOrder(updatedOrder.id),
      );
    }

    return mapPaymentOrder(updatedOrder);
  }

  async getOrderStatus(user: AuthenticatedUser, orderId: string) {
    this.assertStudentUser(user);

    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        siteId: user.siteId,
        userId: user.userId,
        OR: [{ id: orderId }, { merchantOrderCode: orderId }],
      },
      select: paymentOrderSelect,
    });

    if (!order) {
      throw new NotFoundException({
        code: 'PAYMENT_ORDER_NOT_FOUND',
        message: 'Payment order was not found.',
      });
    }

    const reconciled = await this.reconcileIfNeeded(
      order,
      PaymentEventSource.STATUS_POLL,
    );
    return mapPaymentOrder(reconciled);
  }

  async listAdminOrders(siteId: string, query: ListAdminPaymentOrdersQueryDto) {
    const where: Prisma.PaymentOrderWhereInput = {
      siteId,
      status: query.status,
      provider: query.provider,
      userId: query.userId,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        select: paymentOrderSelect,
      }),
      this.prisma.paymentOrder.count({ where }),
    ]);

    return {
      items: items.map((item) => mapPaymentOrder(item)),
      total,
    };
  }

  async getAdminOrder(siteId: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        siteId,
        id: orderId,
      },
      select: paymentOrderSelect,
    });

    if (!order) {
      throw new NotFoundException({
        code: 'PAYMENT_ORDER_NOT_FOUND',
        message: 'Payment order was not found.',
      });
    }

    return mapPaymentOrder(order);
  }

  async reconcileAdminOrder(siteId: string, orderId: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        siteId,
        id: orderId,
      },
      select: paymentOrderSelect,
    });

    if (!order) {
      throw new NotFoundException({
        code: 'PAYMENT_ORDER_NOT_FOUND',
        message: 'Payment order was not found.',
      });
    }

    const reconciled = await this.reconcileIfNeeded(
      order,
      PaymentEventSource.RECONCILIATION,
      true,
    );

    return mapPaymentOrder(reconciled);
  }

  async handlePhonePeCallback(
    payload: unknown,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const callback = this.paymentGatewayService.extractCallback(
      'PHONEPE_STANDARD',
      payload,
      headers,
    );
    const siteId = await this.resolveDefaultSiteId();
    let createdEventId: string | null = null;

    try {
      const event = await this.prisma.paymentEvent.create({
        data: {
          siteId,
          provider: 'PHONEPE_STANDARD',
          source: PaymentEventSource.CALLBACK,
          eventType: callback.eventType,
          dedupeKey: callback.dedupeKey,
          providerEventId: callback.providerEventId,
          status: PaymentEventStatus.RECEIVED,
          payloadJson: callback.payloadJson as Prisma.InputJsonValue,
          headersJson: callback.headersJson as Prisma.InputJsonValue,
        },
        select: {
          id: true,
        },
      });

      createdEventId = event.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return {
          received: true,
          duplicate: true,
          merchantOrderCode: callback.merchantOrderCode,
        };
      }

      throw error;
    }

    if (!callback.merchantOrderCode) {
      if (createdEventId) {
        await this.prisma.paymentEvent.update({
          where: {
            id: createdEventId,
          },
          data: {
            status: PaymentEventStatus.IGNORED,
            errorMessage:
              'merchantOrderCode could not be resolved from callback.',
            processedAt: new Date(),
          },
        });
      }

      return {
        received: true,
        duplicate: false,
        merchantOrderCode: null,
      };
    }

    const order = await this.prisma.paymentOrder.findUnique({
      where: {
        merchantOrderCode: callback.merchantOrderCode,
      },
      select: paymentOrderSelect,
    });

    if (!order) {
      if (createdEventId) {
        await this.prisma.paymentEvent.update({
          where: {
            id: createdEventId,
          },
          data: {
            status: PaymentEventStatus.IGNORED,
            errorMessage: 'Payment order was not found for this callback.',
            processedAt: new Date(),
          },
        });
      }

      return {
        received: true,
        duplicate: false,
        merchantOrderCode: callback.merchantOrderCode,
      };
    }

    const updatedOrder = await this.prisma.paymentEvent.update({
      where: {
        id: createdEventId,
      },
      data: {
        siteId: order.siteId,
        paymentOrderId: order.id,
      },
    });
    void updatedOrder;

    const reconciled = await this.reconcileIfNeeded(
      order,
      PaymentEventSource.CALLBACK,
      true,
      createdEventId ?? undefined,
    );

    return {
      received: true,
      duplicate: false,
      merchantOrderCode: callback.merchantOrderCode,
      status: reconciled.status,
      orderId: reconciled.id,
    };
  }

  private async reconcileIfNeeded(
    order: PaymentOrderRecord,
    source: PaymentEventSource,
    force = false,
    callbackEventId?: string,
  ) {
    if (
      order.expiresAt &&
      order.expiresAt <= new Date() &&
      !isTerminalPaymentStatus(order.status)
    ) {
      return this.prisma.paymentOrder.update({
        where: {
          id: order.id,
        },
        data: {
          status: PaymentOrderStatus.EXPIRED,
        },
        select: paymentOrderSelect,
      });
    }

    if (!force && isTerminalPaymentStatus(order.status)) {
      return order;
    }

    const statusResult = await this.paymentGatewayService.checkStatus(
      order.provider,
      {
        merchantOrderCode: order.merchantOrderCode,
        amountPaise: order.amountPaise,
      },
    );
    const now = new Date();

    const reconciled = await this.prisma.$transaction(async (tx) => {
      if (source !== PaymentEventSource.CALLBACK) {
        await tx.paymentEvent.create({
          data: {
            siteId: order.siteId,
            paymentOrderId: order.id,
            provider: order.provider,
            source,
            eventType: statusResult.providerStatus ?? 'STATUS_CHECK',
            dedupeKey: `${source.toLowerCase()}:${order.merchantOrderCode}:${Date.now()}`,
            status: PaymentEventStatus.PROCESSED,
            payloadJson: statusResult.responseJson as Prisma.InputJsonValue,
            processedAt: now,
          },
        });
      }

      const updatedOrder = await tx.paymentOrder.update({
        where: {
          id: order.id,
        },
        data: {
          status: statusResult.status,
          providerReferenceId: statusResult.providerReferenceId,
          providerStatus: statusResult.providerStatus,
          confirmedAt:
            statusResult.status === PaymentOrderStatus.SUCCEEDED ? now : null,
          callbackConfirmedAt:
            source === PaymentEventSource.CALLBACK &&
            statusResult.status === PaymentOrderStatus.SUCCEEDED
              ? now
              : undefined,
          failedAt:
            statusResult.status === PaymentOrderStatus.FAILED ||
            statusResult.status === PaymentOrderStatus.CANCELLED
              ? now
              : null,
          lastCheckedAt: now,
        },
        select: paymentOrderSelect,
      });

      await tx.paymentTransaction.upsert({
        where: {
          paymentOrderId: order.id,
        },
        update: {
          provider: order.provider,
          providerTransactionId: statusResult.providerTransactionId,
          providerReferenceId: statusResult.providerReferenceId,
          status: statusResult.transactionStatus,
          amountPaise: order.amountPaise,
          currencyCode: order.currencyCode,
          occurredAt: statusResult.occurredAt ?? now,
          responseJson: statusResult.responseJson as Prisma.InputJsonValue,
        },
        create: {
          siteId: order.siteId,
          paymentOrderId: order.id,
          provider: order.provider,
          providerTransactionId: statusResult.providerTransactionId,
          providerReferenceId: statusResult.providerReferenceId,
          status: statusResult.transactionStatus,
          amountPaise: order.amountPaise,
          currencyCode: order.currencyCode,
          occurredAt: statusResult.occurredAt ?? now,
          responseJson: statusResult.responseJson as Prisma.InputJsonValue,
        },
      });

      return updatedOrder;
    });

    if (callbackEventId) {
      await this.prisma.paymentEvent.update({
        where: {
          id: callbackEventId,
        },
        data: {
          status: PaymentEventStatus.PROCESSED,
          processedAt: now,
        },
      });
    }

    if (
      reconciled.status === PaymentOrderStatus.SUCCEEDED &&
      !reconciled.subscription
    ) {
      return this.activateSuccessfulOrder(reconciled.id);
    }

    return reconciled;
  }

  private async activateSuccessfulOrder(orderId: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        siteId: true,
        userId: true,
        planId: true,
        provider: true,
        merchantOrderCode: true,
        status: true,
        amountPaise: true,
        currencyCode: true,
        confirmedAt: true,
        subscription: {
          select: {
            id: true,
          },
        },
        plan: {
          select: planDetailSelect,
        },
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'PAYMENT_ORDER_NOT_FOUND',
        message: 'Payment order was not found.',
      });
    }

    if (order.subscription) {
      return this.prisma.paymentOrder.findFirstOrThrow({
        where: {
          id: order.id,
        },
        select: paymentOrderSelect,
      });
    }

    const now = new Date();
    const subscriptionMode =
      await this.paymentSettingsService.getSubscriptionMode();
    const currentSubscriptions = await this.prisma.subscription.findMany({
      where: {
        siteId: order.siteId,
        userId: order.userId,
        planId: order.planId,
        status: {
          in: [SubscriptionStatus.PENDING, SubscriptionStatus.ACTIVE],
        },
      },
      orderBy: [{ endsAt: 'desc' }],
      select: {
        id: true,
        endsAt: true,
      },
    });

    if (subscriptionMode === 'REPLACE_ACTIVE') {
      await this.entitlementsService.revokeSubscriptionChain(
        order.siteId,
        currentSubscriptions.map((item) => item.id),
        'Replaced by a new successful purchase.',
      );
    }

    const latestEndsAt =
      subscriptionMode === 'EXTEND_ACTIVE'
        ? (currentSubscriptions[0]?.endsAt ?? null)
        : null;
    const startsAt =
      latestEndsAt && latestEndsAt > now
        ? latestEndsAt
        : (order.confirmedAt ?? now);
    const endsAt = new Date(
      startsAt.getTime() + order.plan.durationDays * 24 * 60 * 60_000,
    );

    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.create({
        data: {
          siteId: order.siteId,
          userId: order.userId,
          planId: order.planId,
          paymentOrderId: order.id,
          status:
            startsAt > now
              ? SubscriptionStatus.PENDING
              : SubscriptionStatus.ACTIVE,
          startsAt,
          endsAt,
          metadataJson: {
            provider: order.provider,
            merchantOrderCode: order.merchantOrderCode,
          } satisfies Prisma.JsonObject,
        },
        select: {
          id: true,
        },
      });

      for (const planEntitlement of order.plan.planEntitlements) {
        await tx.entitlement.create({
          data: {
            siteId: order.siteId,
            userId: order.userId,
            planId: order.planId,
            subscriptionId: subscription.id,
            paymentOrderId: order.id,
            sourceType: EntitlementSourceType.PLAN_PURCHASE,
            kind: planEntitlement.entitlementKind,
            scopeJson:
              planEntitlement.scopeJson === null
                ? Prisma.DbNull
                : (planEntitlement.scopeJson as Prisma.InputJsonValue),
            startsAt,
            endsAt,
            metadataJson: {
              planCode: order.plan.code,
              merchantOrderCode: order.merchantOrderCode,
            } satisfies Prisma.JsonObject,
          },
        });
      }
    });

    return this.prisma.paymentOrder.findFirstOrThrow({
      where: {
        id: order.id,
      },
      select: paymentOrderSelect,
    });
  }

  private assertStudentUser(user: AuthenticatedUser) {
    if (user.userType !== UserType.STUDENT) {
      throw new ConflictException({
        code: 'PAYMENTS_STUDENT_ONLY',
        message: 'Only student accounts can create plan checkouts.',
      });
    }
  }

  private buildMerchantOrderCode() {
    // Keep provider order ids short and alphanumeric for HDFC SmartGateway.
    return `tc${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
  }

  private async recordCheckoutInitiationFailure(input: {
    siteId: string;
    provider: PaymentProvider;
    order: {
      id: string;
      merchantOrderCode: string;
      amountPaise: number;
      currencyCode: string;
    };
    error: unknown;
  }) {
    const now = new Date();
    const errorCode = this.extractProviderErrorCode(input.error);
    const errorMessage = this.extractProviderErrorMessage(input.error);
    const errorPayload = this.buildProviderErrorPayload(
      input.error,
      errorCode,
      errorMessage,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentEvent.create({
        data: {
          siteId: input.siteId,
          paymentOrderId: input.order.id,
          provider: input.provider,
          source: PaymentEventSource.CHECKOUT_RESPONSE,
          eventType: 'CHECKOUT_INITIATION_FAILED',
          dedupeKey: `checkout-error:${input.order.merchantOrderCode}`,
          status: PaymentEventStatus.FAILED,
          payloadJson: errorPayload as Prisma.InputJsonValue,
          errorMessage,
          processedAt: now,
        },
      });

      await tx.paymentTransaction.upsert({
        where: {
          paymentOrderId: input.order.id,
        },
        update: {
          provider: input.provider,
          providerTransactionId: null,
          providerReferenceId: null,
          status: 'FAILED',
          amountPaise: input.order.amountPaise,
          currencyCode: input.order.currencyCode,
          occurredAt: now,
          responseJson: errorPayload as Prisma.InputJsonValue,
        },
        create: {
          siteId: input.siteId,
          paymentOrderId: input.order.id,
          provider: input.provider,
          status: 'FAILED',
          amountPaise: input.order.amountPaise,
          currencyCode: input.order.currencyCode,
          occurredAt: now,
          responseJson: errorPayload as Prisma.InputJsonValue,
        },
      });

      await tx.paymentOrder.update({
        where: {
          id: input.order.id,
        },
        data: {
          status: PaymentOrderStatus.FAILED,
          providerStatus: errorCode ?? 'INITIATION_FAILED',
          failedAt: now,
          lastCheckedAt: now,
        },
      });
    });
  }

  private extractProviderErrorCode(error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = error.response;
      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string' &&
        response.code.trim().length > 0
      ) {
        return response.code.trim();
      }
    }

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      typeof error.code === 'string' &&
      error.code.trim().length > 0
    ) {
      return error.code.trim();
    }

    return null;
  }

  private extractProviderErrorMessage(error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = error.response;
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        typeof response.message === 'string' &&
        response.message.trim().length > 0
      ) {
        return response.message.trim();
      }
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message.trim();
    }

    return 'Payment checkout initiation failed.';
  }

  private buildProviderErrorPayload(
    error: unknown,
    code: string | null,
    message: string,
  ) {
    const payload: Prisma.JsonObject = {
      message,
    };

    if (code) {
      payload.code = code;
    }

    if (error instanceof Error) {
      payload.name = error.name;
    }

    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number'
    ) {
      payload.status = error.status;
    }

    return payload;
  }

  private async resolveDefaultSiteId() {
    const bootstrap = await this.siteSettingsService.getPublicBootstrap();
    return bootstrap.site.id;
  }
}
