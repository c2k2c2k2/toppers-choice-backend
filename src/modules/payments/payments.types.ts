import {
  EntitlementKind,
  EntitlementSourceType,
  PaymentEventSource,
  PaymentEventStatus,
  PaymentOrderStatus,
  PaymentProvider,
  PaymentTransactionStatus,
  PlanStatus,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';

const userSummarySelect = {
  id: true,
  email: true,
  fullName: true,
} satisfies Prisma.UserSelect;

export const planEntitlementSelect =
  Prisma.validator<Prisma.PlanEntitlementSelect>()({
    id: true,
    entitlementKind: true,
    scopeJson: true,
    orderIndex: true,
    createdAt: true,
    updatedAt: true,
  });

export const planSummarySelect = Prisma.validator<Prisma.PlanSelect>()({
  id: true,
  code: true,
  slug: true,
  name: true,
  shortDescription: true,
  description: true,
  pricePaise: true,
  currencyCode: true,
  durationDays: true,
  sortOrder: true,
  status: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
});

export const planDetailSelect = Prisma.validator<Prisma.PlanSelect>()({
  ...planSummarySelect,
  planEntitlements: {
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: planEntitlementSelect,
  },
});

export const subscriptionSummarySelect =
  Prisma.validator<Prisma.SubscriptionSelect>()({
    id: true,
    status: true,
    startsAt: true,
    endsAt: true,
    cancelledAt: true,
    revokedAt: true,
    revokedReason: true,
    metadataJson: true,
    createdAt: true,
    updatedAt: true,
    plan: {
      select: planSummarySelect,
    },
  });

export const entitlementSelect = Prisma.validator<Prisma.EntitlementSelect>()({
  id: true,
  sourceType: true,
  kind: true,
  scopeJson: true,
  startsAt: true,
  endsAt: true,
  revokedAt: true,
  revokedReason: true,
  metadataJson: true,
  createdAt: true,
  updatedAt: true,
  plan: {
    select: planSummarySelect,
  },
  subscription: {
    select: subscriptionSummarySelect,
  },
  paymentOrder: {
    select: {
      id: true,
      merchantOrderCode: true,
      status: true,
    },
  },
  grantedByUser: {
    select: userSummarySelect,
  },
});

export const paymentOrderSelect = Prisma.validator<Prisma.PaymentOrderSelect>()(
  {
    siteId: true,
    id: true,
    merchantOrderCode: true,
    provider: true,
    amountPaise: true,
    currencyCode: true,
    status: true,
    redirectUrl: true,
    providerOrderId: true,
    providerReferenceId: true,
    providerStatus: true,
    callbackConfirmedAt: true,
    confirmedAt: true,
    failedAt: true,
    expiresAt: true,
    lastCheckedAt: true,
    metadataJson: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: userSummarySelect,
    },
    plan: {
      select: planSummarySelect,
    },
    subscription: {
      select: subscriptionSummarySelect,
    },
  },
);

export const paymentEventSelect = Prisma.validator<Prisma.PaymentEventSelect>()(
  {
    id: true,
    provider: true,
    source: true,
    eventType: true,
    dedupeKey: true,
    providerEventId: true,
    status: true,
    payloadJson: true,
    headersJson: true,
    errorMessage: true,
    receivedAt: true,
    processedAt: true,
    createdAt: true,
    updatedAt: true,
  },
);

export type PlanSummaryRecord = Prisma.PlanGetPayload<{
  select: typeof planSummarySelect;
}>;

export type PlanDetailRecord = Prisma.PlanGetPayload<{
  select: typeof planDetailSelect;
}>;

export type SubscriptionSummaryRecord = Prisma.SubscriptionGetPayload<{
  select: typeof subscriptionSummarySelect;
}>;

export type EntitlementRecord = Prisma.EntitlementGetPayload<{
  select: typeof entitlementSelect;
}>;

export type PaymentOrderRecord = Prisma.PaymentOrderGetPayload<{
  select: typeof paymentOrderSelect;
}>;

export type PaymentEventRecord = Prisma.PaymentEventGetPayload<{
  select: typeof paymentEventSelect;
}>;

export type EntitlementCriteria = {
  noteId?: string | null;
  contentEntryId?: string | null;
  testId?: string | null;
  family?: string | null;
  mode?: string | null;
  examTrackId?: string | null;
  mediumId?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  topicIds?: string[];
  examTrackIds?: string[];
  mediumIds?: string[];
  difficulty?: string | null;
};

export type PaymentProviderCheckoutInput = {
  order: {
    id: string;
    merchantOrderCode: string;
    amountPaise: number;
    currencyCode: string;
  };
  purchaser: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type ProviderCheckoutResult = {
  status: PaymentOrderStatus;
  redirectUrl: string | null;
  providerOrderId: string | null;
  providerReferenceId: string | null;
  providerStatus: string | null;
  metadataJson: Prisma.JsonObject;
};

export type ProviderStatusResult = {
  status: PaymentOrderStatus;
  transactionStatus: PaymentTransactionStatus;
  providerTransactionId: string | null;
  providerReferenceId: string | null;
  providerStatus: string | null;
  occurredAt: Date | null;
  responseJson: Prisma.JsonObject;
};

export type ProviderCallbackPayload = {
  merchantOrderCode: string | null;
  providerEventId: string | null;
  eventType: string;
  dedupeKey: string;
  payloadJson: Prisma.JsonObject;
  headersJson: Prisma.JsonObject;
};

function asObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function mapPlanEntitlement(
  record: PlanDetailRecord['planEntitlements'][number],
) {
  return {
    id: record.id,
    entitlementKind: record.entitlementKind,
    scopeJson: asObject(record.scopeJson),
    orderIndex: record.orderIndex,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapPlan(record: PlanDetailRecord | PlanSummaryRecord) {
  return {
    id: record.id,
    code: record.code,
    slug: record.slug,
    name: record.name,
    shortDescription: record.shortDescription,
    description: record.description,
    pricePaise: record.pricePaise,
    currencyCode: record.currencyCode,
    durationDays: record.durationDays,
    sortOrder: record.sortOrder,
    status: record.status,
    metadataJson: asObject(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    entitlements:
      'planEntitlements' in record
        ? record.planEntitlements.map((item) => mapPlanEntitlement(item))
        : [],
  };
}

export function mapSubscription(record: SubscriptionSummaryRecord) {
  return {
    id: record.id,
    status: record.status,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    cancelledAt: record.cancelledAt,
    revokedAt: record.revokedAt,
    revokedReason: record.revokedReason,
    metadataJson: asObject(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    plan: mapPlan(record.plan),
  };
}

export function mapEntitlement(record: EntitlementRecord) {
  return {
    id: record.id,
    sourceType: record.sourceType,
    kind: record.kind,
    scopeJson: asObject(record.scopeJson),
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    revokedAt: record.revokedAt,
    revokedReason: record.revokedReason,
    metadataJson: asObject(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    plan: record.plan ? mapPlan(record.plan) : null,
    subscription: record.subscription ? mapSubscription(record.subscription) : null,
    paymentOrder: record.paymentOrder
      ? {
          id: record.paymentOrder.id,
          merchantOrderCode: record.paymentOrder.merchantOrderCode,
          status: record.paymentOrder.status,
        }
      : null,
    grantedByUser: record.grantedByUser
      ? {
          id: record.grantedByUser.id,
          email: record.grantedByUser.email,
          fullName: record.grantedByUser.fullName,
        }
      : null,
  };
}

export function mapPaymentOrder(record: PaymentOrderRecord) {
  return {
    id: record.id,
    merchantOrderCode: record.merchantOrderCode,
    provider: record.provider,
    amountPaise: record.amountPaise,
    currencyCode: record.currencyCode,
    status: record.status,
    redirectUrl: record.redirectUrl,
    providerOrderId: record.providerOrderId,
    providerReferenceId: record.providerReferenceId,
    providerStatus: record.providerStatus,
    callbackConfirmedAt: record.callbackConfirmedAt,
    confirmedAt: record.confirmedAt,
    failedAt: record.failedAt,
    expiresAt: record.expiresAt,
    lastCheckedAt: record.lastCheckedAt,
    metadataJson: asObject(record.metadataJson),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    user: {
      id: record.user.id,
      email: record.user.email,
      fullName: record.user.fullName,
    },
    plan: mapPlan(record.plan),
    subscription: record.subscription
      ? mapSubscription(record.subscription)
      : null,
  };
}

export function mapPaymentEvent(record: PaymentEventRecord) {
  return {
    id: record.id,
    provider: record.provider,
    source: record.source,
    eventType: record.eventType,
    dedupeKey: record.dedupeKey,
    providerEventId: record.providerEventId,
    status: record.status,
    payloadJson: asObject(record.payloadJson) ?? {},
    headersJson: asObject(record.headersJson),
    errorMessage: record.errorMessage,
    receivedAt: record.receivedAt,
    processedAt: record.processedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function isActiveEntitlement(
  record: Pick<EntitlementRecord, 'startsAt' | 'endsAt' | 'revokedAt'>,
  now = new Date(),
) {
  if (record.revokedAt) {
    return false;
  }

  if (record.startsAt > now) {
    return false;
  }

  if (record.endsAt && record.endsAt <= now) {
    return false;
  }

  return true;
}

export function isTerminalPaymentStatus(status: PaymentOrderStatus) {
  return (
    [
      PaymentOrderStatus.SUCCEEDED,
      PaymentOrderStatus.FAILED,
      PaymentOrderStatus.CANCELLED,
      PaymentOrderStatus.EXPIRED,
    ] as PaymentOrderStatus[]
  ).includes(status);
}

export function isActiveSubscriptionStatus(status: SubscriptionStatus) {
  return status === SubscriptionStatus.ACTIVE;
}

export function mapPhonePeStateToOrderStatus(state: string | null | undefined) {
  switch ((state ?? '').toUpperCase()) {
    case 'COMPLETED':
    case 'SUCCESS':
      return PaymentOrderStatus.SUCCEEDED;
    case 'FAILED':
    case 'PAYMENT_ERROR':
      return PaymentOrderStatus.FAILED;
    case 'CANCELLED':
    case 'CANCELED':
      return PaymentOrderStatus.CANCELLED;
    default:
      return PaymentOrderStatus.PENDING;
  }
}

export function mapPhonePeStateToTransactionStatus(
  state: string | null | undefined,
) {
  switch ((state ?? '').toUpperCase()) {
    case 'COMPLETED':
    case 'SUCCESS':
      return PaymentTransactionStatus.SUCCEEDED;
    case 'FAILED':
    case 'PAYMENT_ERROR':
      return PaymentTransactionStatus.FAILED;
    case 'CANCELLED':
    case 'CANCELED':
      return PaymentTransactionStatus.CANCELLED;
    default:
      return PaymentTransactionStatus.PENDING;
  }
}

export function mapHdfcStatusToOrderStatus(status: string | null | undefined) {
  switch ((status ?? '').toUpperCase()) {
    case 'CHARGED':
      return PaymentOrderStatus.SUCCEEDED;
    case 'CANCELLED':
    case 'CANCELED':
    case 'USER_ABORTED':
    case 'USER_DROPPED':
      return PaymentOrderStatus.CANCELLED;
    case 'FAILED':
    case 'AUTHORIZATION_FAILED':
    case 'AUTHENTICATION_FAILED':
    case 'AUTHORIZER_ERROR':
    case 'AUTO_REFUNDED':
    case 'DECLINED':
    case 'JUSPAY_DECLINED':
    case 'NOT_CHARGED':
    case 'PARTIAL_CHARGED':
    case 'PARTIALLY_CHARGED':
    case 'VOID':
      return PaymentOrderStatus.FAILED;
    case 'AUTHORIZED':
    case 'AUTHORIZING':
    case 'CHARGING':
    case 'COD_INITIATED':
    case 'NEW':
    case 'PENDING':
    case 'PENDING_VBV':
    case 'STARTED':
    case 'TO_BE_CHARGED':
    default:
      return PaymentOrderStatus.PENDING;
  }
}

export function mapHdfcStatusToTransactionStatus(
  status: string | null | undefined,
) {
  switch ((status ?? '').toUpperCase()) {
    case 'CHARGED':
      return PaymentTransactionStatus.SUCCEEDED;
    case 'CANCELLED':
    case 'CANCELED':
    case 'USER_ABORTED':
    case 'USER_DROPPED':
      return PaymentTransactionStatus.CANCELLED;
    case 'FAILED':
    case 'AUTHORIZATION_FAILED':
    case 'AUTHENTICATION_FAILED':
    case 'AUTHORIZER_ERROR':
    case 'AUTO_REFUNDED':
    case 'DECLINED':
    case 'JUSPAY_DECLINED':
    case 'NOT_CHARGED':
    case 'PARTIAL_CHARGED':
    case 'PARTIALLY_CHARGED':
    case 'VOID':
      return PaymentTransactionStatus.FAILED;
    case 'AUTHORIZED':
    case 'AUTHORIZING':
    case 'CHARGING':
    case 'COD_INITIATED':
    case 'NEW':
    case 'PENDING':
    case 'PENDING_VBV':
    case 'STARTED':
    case 'TO_BE_CHARGED':
    default:
      return PaymentTransactionStatus.PENDING;
  }
}

export function buildPaymentEventMetadata(
  input: Pick<
    PaymentEventRecord,
    'provider' | 'source' | 'eventType' | 'status'
  >,
) {
  return {
    provider: input.provider,
    source: input.source,
    eventType: input.eventType,
    status: input.status,
  };
}

export const PAYMENT_SWAGGER_ENUMS = {
  EntitlementKind,
  EntitlementSourceType,
  PaymentEventSource,
  PaymentEventStatus,
  PaymentOrderStatus,
  PaymentProvider,
  PaymentTransactionStatus,
  PlanStatus,
  SubscriptionStatus,
};
