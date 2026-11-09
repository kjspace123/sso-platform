import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV } from '../config/env.module';
import type { Env } from '@sso-platform/config';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.redis.quit();
  }
}

/**
 * Redis is used only for temporary/high-speed state — rate limiting, login
 * attempt counters, and short-lived OAuth/interaction state (section 6.7).
 * PostgreSQL remains the authoritative store.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (env: Env) => {
        const client = new Redis(env.REDIS_URL, { lazyConnect: false });
        client.on('connect', () => new Logger('RedisModule').log('Connected to Redis'));
        client.on('error', (err) => new Logger('RedisModule').error(err.message));
        return client;
      },
      inject: [ENV],
    },
    RedisLifecycle,
  ],
  exports: [REDIS],
})
export class RedisModule {}
