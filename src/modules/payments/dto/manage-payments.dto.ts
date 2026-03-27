import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EntitlementKind,
  PaymentOrderStatus,
  PaymentProvider,
  PlanStatus,
} from '@prisma/client';

const PLAN_CODE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return value;
}

function slugifyPlanValue(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export class PlanEntitlementInputDto {
  @ApiProperty({ enum: EntitlementKind })
  @IsEnum(EntitlementKind)
  entitlementKind!: EntitlementKind;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  scopeJson?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 0 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  orderIndex?: number;
}

class PlanMutationBaseDto {
  @ApiProperty({ example: 'mpsc-premium-90d' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @Matches(PLAN_CODE_PATTERN)
  @MaxLength(80)
  code!: string;

  @ApiPropertyOptional({ example: 'mpsc-premium-90d' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0
      ? slugifyPlanValue(value)
      : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiProperty({ example: 'MPSC Premium 90 Days' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({
    example: 'Premium notes, tests, content, and practice for 90 days.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(320)
  shortDescription?: string;

  @ApiPropertyOptional({
    example: 'Detailed plan copy shown in the pricing UI.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @ApiProperty({ example: 49900 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsInt()
  @Min(1)
  pricePaise!: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currencyCode?: string;

  @ApiProperty({ example: 90 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(3660)
  durationDays!: number;

  @ApiPropertyOptional({ example: 0 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: PlanStatus, default: PlanStatus.INACTIVE })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown>;

  @ApiProperty({ type: [PlanEntitlementInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlanEntitlementInputDto)
  entitlements!: PlanEntitlementInputDto[];
}

export class CreatePlanDto extends PlanMutationBaseDto {}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

export class ListPlansQueryDto {
  @ApiPropertyOptional({ enum: PlanStatus })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @ApiPropertyOptional({ example: 'premium' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class CreateCheckoutDto {
  @ApiPropertyOptional({ example: 'cmcplan123' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ example: 'mpsc-premium-90d' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @Matches(PLAN_CODE_PATTERN)
  @MaxLength(80)
  planCode?: string;
}

export class GrantEntitlementDto {
  @ApiProperty({ example: 'cmcuser123' })
  @IsString()
  userId!: string;

  @ApiPropertyOptional({ example: 'cmcplan123' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: EntitlementKind })
  @IsOptional()
  @IsEnum(EntitlementKind)
  kind?: EntitlementKind;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional()
  @IsObject()
  scopeJson?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-03-26T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-06-24T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiPropertyOptional({
    type: Object,
    nullable: true,
    example: { reason: 'Customer support courtesy extension' },
  })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown>;
}

export class RevokeEntitlementDto {
  @ApiProperty({ example: 'Plan access revoked after refund approval.' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ListAdminPaymentOrdersQueryDto {
  @ApiPropertyOptional({ enum: PaymentOrderStatus })
  @IsOptional()
  @IsEnum(PaymentOrderStatus)
  status?: PaymentOrderStatus;

  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @ApiPropertyOptional({ example: 'cmcuser123' })
  @IsOptional()
  @IsString()
  userId?: string;
}
