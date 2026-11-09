/*
  Warnings:

  - You are about to drop the `refresh_tokens` table. If the migration is applied, all the data in the `refresh_tokens` table will be lost.
    This table was never written to or read by application code — OIDC refresh
    token rotation is handled entirely by oidc-provider's own Redis-backed
    adapter (see apps/api/src/oidc/redis-adapter.ts), which uses an unrelated
    "RefreshToken" model name. This was confusing dead scaffolding.

*/
-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_sessionId_fkey";

-- DropTable
DROP TABLE "refresh_tokens";

-- DropIndex
DROP INDEX "sessions_userId_idx";

-- CreateIndex
-- Backs sessions.service.ts's listActiveForUser/listAll queries, which
-- filter on revokedAt/expiresAt and sort by lastSeenAt.
CREATE INDEX "sessions_userId_revokedAt_expiresAt_idx" ON "sessions"("userId", "revokedAt", "expiresAt");
