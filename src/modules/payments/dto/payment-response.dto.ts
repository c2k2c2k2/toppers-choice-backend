import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EntitlementKind,
  EntitlementSourceType,
  PaymentEventSource,
  PaymentEventStatus,
  PaymentOrderStatus,
  PaymentProvider,
  PlanStatus,
  SubscriptionStatus,
} from '@prisma/client';

export class PaymentPlanEntitlementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EntitlementKind })
  entitlementKind!: EntitlementKind;

  @ApiPropertyOptional({ type: Object, nullable: true })
  scopeJson!: Record<string, unknown> | null;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  shortDescription!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  pricePaise!: number;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty()
  durationDays!: number;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ enum: PlanStatus })
  status!: PlanStatus;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [PaymentPlanEntitlementResponseDto] })
  entitlements!: PaymentPlanEntitlementResponseDto[];
}

export class PlansListResponseDto {
  @ApiProperty({ type: [PlanResponseDto] })
  items!: PlanResponseDto[];

  @ApiProperty()
  total!: number;
}

export class SubscriptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: SubscriptionStatus })
  status!: SubscriptionStatus;

  @ApiProperty()
  startsAt!: Date;

  @ApiProperty()
  endsAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  cancelledAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  revokedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  revokedReason!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: PlanResponseDto })
  plan!: PlanResponseDto;
}

export class PaymentOrderUserSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;
}

export class PaymentOrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  merchantOrderCode!: string;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty()
  amountPaise!: number;

  @ApiProperty()
  currencyCode!: string;

  @ApiProperty({ enum: PaymentOrderStatus })
  status!: PaymentOrderStatus;

  @ApiPropertyOptional({ nullable: true })
  redirectUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  providerOrderId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  providerReferenceId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  providerStatus!: string | null;

  @ApiPropertyOptional({ nullable: true })
  callbackConfirmedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  confirmedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  failedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastCheckedAt!: Date | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: PaymentOrderUserSummaryResponseDto })
  user!: PaymentOrderUserSummaryResponseDto;

  @ApiProperty({ type: PlanResponseDto })
  plan!: PlanResponseDto;

  @ApiPropertyOptional({ type: SubscriptionResponseDto, nullable: true })
  subscription!: SubscriptionResponseDto | null;
}

export class PaymentOrdersListResponseDto {
  @ApiProperty({ type: [PaymentOrderResponseDto] })
  items!: PaymentOrderResponseDto[];

  @ApiProperty()
  total!: number;
}

export class CheckoutResponseDto extends PaymentOrderResponseDto {}

export class EntitlementPaymentOrderSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  merchantOrderCode!: string;

  @ApiProperty({ enum: PaymentOrderStatus })
  status!: PaymentOrderStatus;
}

export class EntitlementGrantedByUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;
}

export class EntitlementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: EntitlementSourceType })
  sourceType!: EntitlementSourceType;

  @ApiProperty({ enum: EntitlementKind })
  kind!: EntitlementKind;

  @ApiPropertyOptional({ type: Object, nullable: true })
  scopeJson!: Record<string, unknown> | null;

  @ApiProperty()
  startsAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  endsAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  revokedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  revokedReason!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: PlanResponseDto, nullable: true })
  plan!: PlanResponseDto | null;

  @ApiPropertyOptional({ type: SubscriptionResponseDto, nullable: true })
  subscription!: SubscriptionResponseDto | null;

  @ApiPropertyOptional({
    type: EntitlementPaymentOrderSummaryResponseDto,
    nullable: true,
  })
  paymentOrder!: EntitlementPaymentOrderSummaryResponseDto | null;

  @ApiPropertyOptional({
    type: EntitlementGrantedByUserResponseDto,
    nullable: true,
  })
  grantedByUser!: EntitlementGrantedByUserResponseDto | null;
}

export class EntitlementsListResponseDto {
  @ApiProperty({ type: [EntitlementResponseDto] })
  items!: EntitlementResponseDto[];

  @ApiProperty()
  total!: number;
}

export class PaymentEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentEventSource })
  source!: PaymentEventSource;

  @ApiProperty()
  eventType!: string;

  @ApiProperty()
  dedupeKey!: string;

  @ApiPropertyOptional({ nullable: true })
  providerEventId!: string | null;

  @ApiProperty({ enum: PaymentEventStatus })
  status!: PaymentEventStatus;

  @ApiProperty({ type: Object })
  payloadJson!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  headersJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  errorMessage!: string | null;

  @ApiProperty()
  receivedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  processedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaymentCallbackAckResponseDto {
  @ApiProperty()
  received!: boolean;

  @ApiProperty()
  duplicate!: boolean;

  @ApiPropertyOptional({ nullable: true })
  merchantOrderCode!: string | null;

  @ApiPropertyOptional({ enum: PaymentOrderStatus, nullable: true })
  status!: PaymentOrderStatus | null;

  @ApiPropertyOptional({ nullable: true })
  orderId!: string | null;
}
