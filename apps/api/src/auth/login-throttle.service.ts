import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../database/redis.module';

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60; // 15 minutes

/**
 * Login attempt throttling backed by Redis (section 6.7 / section 16).
 * Keyed by email+ip so a single attacker can't lock out a legitimate user's
 * IP-independent access, while still bounding brute-force attempts.
 */
@Injectable()
export class LoginThrottleService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(email: string, ipAddress: string) {
    return `login-attempts:${email.toLowerCase()}:${ipAddress}`;
  }

  async assertNotThrottled(email: string, ipAddress: string): Promise<void> {
    const attempts = await this.redis.get(this.key(email, ipAddress));
    if (attempts && Number(attempts) >= MAX_ATTEMPTS) {
      throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async recordFailure(email: string, ipAddress: string): Promise<void> {
    const key = this.key(email, ipAddress);
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }
  }

  async reset(email: string, ipAddress: string): Promise<void> {
    await this.redis.del(this.key(email, ipAddress));
  }
}
