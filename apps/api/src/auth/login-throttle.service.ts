import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../database/redis.module';

const MAX_ATTEMPTS_PER_IP = 10;
// Aggregate ceiling across *all* source IPs for a single account, so an
// attacker rotating IPs (botnet/proxy) can't get a fresh 10-attempt budget
// per IP against the same victim. Deliberately higher than the per-IP limit
// so it only kicks in for genuinely distributed attacks, not a legitimate
// user retrying from a couple of networks.
const MAX_ATTEMPTS_PER_EMAIL = 30;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

/**
 * Login attempt throttling backed by Redis (section 6.7 / section 16).
 * Keyed by email+ip (bounds a single source) and by email alone (bounds
 * distributed attempts against one account regardless of source IP).
 */
@Injectable()
export class LoginThrottleService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private ipKey(email: string, ipAddress: string) {
    return `login-attempts:${email.toLowerCase()}:${ipAddress}`;
  }

  private emailKey(email: string) {
    return `login-attempts:${email.toLowerCase()}`;
  }

  async assertNotThrottled(email: string, ipAddress: string): Promise<void> {
    const [ipAttempts, emailAttempts] = await Promise.all([
      this.redis.get(this.ipKey(email, ipAddress)),
      this.redis.get(this.emailKey(email)),
    ]);
    if (
      (ipAttempts && Number(ipAttempts) >= MAX_ATTEMPTS_PER_IP) ||
      (emailAttempts && Number(emailAttempts) >= MAX_ATTEMPTS_PER_EMAIL)
    ) {
      throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(email: string, ipAddress: string): Promise<void> {
    await Promise.all([
      this.bumpKey(this.ipKey(email, ipAddress)),
      this.bumpKey(this.emailKey(email)),
    ]);
  }

  async reset(email: string, ipAddress: string): Promise<void> {
    await this.redis.del(this.ipKey(email, ipAddress), this.emailKey(email));
  }

  private async bumpKey(key: string): Promise<void> {
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }
  }
}
