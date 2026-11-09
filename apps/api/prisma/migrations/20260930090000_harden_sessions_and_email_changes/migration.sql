ALTER TABLE "users" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "sessions" ADD COLUMN "tokenHash" TEXT;
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
-- Legacy IDs were exposed by the session API and must no longer authenticate.
UPDATE "sessions" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "revokedAt" IS NULL;
