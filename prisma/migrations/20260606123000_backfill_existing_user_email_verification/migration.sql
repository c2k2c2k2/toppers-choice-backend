-- Existing users predate mandatory email OTP, so treat their current email
-- addresses as already verified during this rollout.
UPDATE "users"
SET "emailVerifiedAt" = COALESCE("lastLoginAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "emailVerifiedAt" IS NULL;
