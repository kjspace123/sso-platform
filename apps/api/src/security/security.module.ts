import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

/**
 * Global request rate limiting (section 16). This is a coarse, IP-based
 * safety net; the tighter per-account login throttle lives in
 * auth/login-throttle.service.ts (Redis-backed, section 6.7).
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class SecurityModule {}
