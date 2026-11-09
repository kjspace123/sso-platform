import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type Redis from 'ioredis';
import type { Env } from '@sso-platform/config';
import { REDIS } from '../database/redis.module';
import { ENV } from '../config/env.module';

export const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('PTTL', KEYS[1])}
`;

@Injectable()
export class RequestRateLimiter {
  private readonly logger = new Logger(RequestRateLimiter.name);
  constructor(@Inject(REDIS) private readonly redis: Redis, @Inject(ENV) private readonly env: Env) {}

  // Installed before Nest and oidc-provider; all replicas share counters.
  readonly middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.path === '/health' || req.method === 'OPTIONS') { next(); return; }
    const address = createHash('sha256').update(req.ip ?? req.socket.remoteAddress ?? 'unknown').digest('hex');
    const family = req.path.startsWith('/api/') ? 'api' : 'oidc';
    const limit = family === 'api' ? this.env.API_RATE_LIMIT : this.env.OIDC_RATE_LIMIT;
    try {
      const [count, remainingMs] = await this.redis.eval(
        RATE_LIMIT_SCRIPT, 1, `request-limit:${family}:${address}`, 60_000,
      ) as [number, number];
      if (count > limit) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil(remainingMs / 1000)));
        res.status(429).json({ statusCode: 429, error: 'too_many_requests', message: 'Too many requests' });
        return;
      }
    } catch {
      this.logger.error('Request rate-limit storage unavailable');
      res.status(503).json({ statusCode: 503, error: 'temporarily_unavailable' });
      return;
    }
    next();
  };
}
