-- CreateEnum
CREATE TYPE "TestAccessType" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EntitlementKind" AS ENUM ('NOTES_PREMIUM', 'CONTENT_PREMIUM', 'PRACTICE_PREMIUM', 'TESTS_PREMIUM', 'ALL_PREMIUM');

-- CreateEnum
CREATE TYPE "EntitlementSourceType" AS ENUM ('PLAN_PURCHASE', 'ADMIN_GRANT', 'SYSTEM_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('PHONEPE_STANDARD');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentEventSource" AS ENUM ('CHECKOUT_RESPONSE', 'CALLBACK', 'STATUS_POLL', 'RECONCILIATION');

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "accessType" "TestAccessType" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "pricePaise" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "durationDays" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PlanStatus" NOT NULL DEFAULT 'INACTIVE',
    "metadataJson" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_entitlements" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "entitlementKind" "EntitlementKind" NOT NULL,
    "scopeJson" JSONB,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "paymentOrderId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT,
    "subscriptionId" TEXT,
    "paymentOrderId" TEXT,
    "grantedByUserId" TEXT,
    "sourceType" "EntitlementSourceType" NOT NULL,
    "kind" "EntitlementKind" NOT NULL,
    "scopeJson" JSONB,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "merchantOrderCode" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'CREATED',
    "redirectUrl" TEXT,
    "providerOrderId" TEXT,
    "providerReferenceId" TEXT,
    "providerStatus" TEXT,
    "callbackConfirmedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerTransactionId" TEXT,
    "providerReferenceId" TEXT,
    "status" "PaymentTransactionStatus" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "occurredAt" TIMESTAMP(3),
    "responseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "paymentOrderId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "source" "PaymentEventSource" NOT NULL,
    "eventType" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerEventId" TEXT,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payloadJson" JSONB NOT NULL,
    "headersJson" JSONB,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plans_siteId_status_sortOrder_idx" ON "plans"("siteId", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "plans_siteId_code_key" ON "plans"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "plans_siteId_slug_key" ON "plans"("siteId", "slug");

-- CreateIndex
CREATE INDEX "plan_entitlements_siteId_entitlementKind_idx" ON "plan_entitlements"("siteId", "entitlementKind");

-- CreateIndex
CREATE INDEX "plan_entitlements_planId_orderIndex_idx" ON "plan_entitlements"("planId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_paymentOrderId_key" ON "subscriptions"("paymentOrderId");

-- CreateIndex
CREATE INDEX "subscriptions_siteId_userId_status_endsAt_idx" ON "subscriptions"("siteId", "userId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "subscriptions_siteId_planId_status_startsAt_idx" ON "subscriptions"("siteId", "planId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "entitlements_siteId_userId_kind_startsAt_endsAt_idx" ON "entitlements"("siteId", "userId", "kind", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "entitlements_siteId_userId_revokedAt_endsAt_idx" ON "entitlements"("siteId", "userId", "revokedAt", "endsAt");

-- CreateIndex
CREATE INDEX "entitlements_subscriptionId_idx" ON "entitlements"("subscriptionId");

-- CreateIndex
CREATE INDEX "entitlements_paymentOrderId_idx" ON "entitlements"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_merchantOrderCode_key" ON "payment_orders"("merchantOrderCode");

-- CreateIndex
CREATE INDEX "payment_orders_siteId_userId_status_createdAt_idx" ON "payment_orders"("siteId", "userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_orders_siteId_planId_status_createdAt_idx" ON "payment_orders"("siteId", "planId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_orders_siteId_provider_status_createdAt_idx" ON "payment_orders"("siteId", "provider", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_paymentOrderId_key" ON "payment_transactions"("paymentOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_providerTransactionId_key" ON "payment_transactions"("providerTransactionId");

-- CreateIndex
CREATE INDEX "payment_transactions_siteId_provider_status_createdAt_idx" ON "payment_transactions"("siteId", "provider", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_dedupeKey_key" ON "payment_events"("dedupeKey");

-- CreateIndex
CREATE INDEX "payment_events_siteId_provider_source_receivedAt_idx" ON "payment_events"("siteId", "provider", "source", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_events_paymentOrderId_receivedAt_idx" ON "payment_events"("paymentOrderId", "receivedAt");

-- CreateIndex
CREATE INDEX "tests_siteId_accessType_status_publishedAt_idx" ON "tests"("siteId", "accessType", "status", "publishedAt");

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
