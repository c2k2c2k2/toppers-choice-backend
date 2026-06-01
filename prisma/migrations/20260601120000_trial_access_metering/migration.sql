-- CreateEnum
CREATE TYPE "TrialAccessStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'DISABLED');

-- CreateTable
CREATE TABLE "trial_accesses" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TrialAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "consumedSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastStoppedAt" TIMESTAMP(3),
    "exhaustedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trial_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_usage_events" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trialAccessId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "chargedSeconds" INTEGER NOT NULL DEFAULT 0,
    "consumedSeconds" INTEGER NOT NULL,
    "remainingSeconds" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trial_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trial_accesses_siteId_userId_key" ON "trial_accesses"("siteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "trial_accesses_userId_key" ON "trial_accesses"("userId");

-- CreateIndex
CREATE INDEX "trial_accesses_siteId_status_updatedAt_idx" ON "trial_accesses"("siteId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "trial_accesses_siteId_userId_status_idx" ON "trial_accesses"("siteId", "userId", "status");

-- CreateIndex
CREATE INDEX "trial_usage_events_siteId_userId_occurredAt_idx" ON "trial_usage_events"("siteId", "userId", "occurredAt");

-- CreateIndex
CREATE INDEX "trial_usage_events_trialAccessId_occurredAt_idx" ON "trial_usage_events"("trialAccessId", "occurredAt");

-- AddForeignKey
ALTER TABLE "trial_accesses" ADD CONSTRAINT "trial_accesses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_accesses" ADD CONSTRAINT "trial_accesses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_usage_events" ADD CONSTRAINT "trial_usage_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_usage_events" ADD CONSTRAINT "trial_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_usage_events" ADD CONSTRAINT "trial_usage_events_trialAccessId_fkey" FOREIGN KEY ("trialAccessId") REFERENCES "trial_accesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BackfillConfig
UPDATE "site_config_versions"
SET "configJson" = jsonb_set(
    "configJson",
    '{trial}',
    '{"enabled": true, "totalMinutes": 20, "heartbeatSeconds": 30, "maxHeartbeatGapSeconds": 90}'::jsonb,
    true
)
WHERE "configKey" = 'payments.runtime'
  AND "configJson"->'trial' IS NULL;
