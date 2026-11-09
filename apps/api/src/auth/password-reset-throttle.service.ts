import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../database/redis.module';

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 60 * 60; // 1 hour

/**
 * Rate-limits `forgot-password` requests per email address. Without this,
 * the global per-IP limiter is the only defense, so an attacker rotating
 * source IPs could email-bomb a victim's inbox with repeated reset links.
 * Deliberately keyed by email only (not email+ip) — the goal here is
 * protecting the recipient's inbox, not the requester's budget.
 */
@Injectable()
export class PasswordResetThrottleService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(email: string) {
    return `password-reset-requests:${email.toLowerCase()}`;
  }

  async assertNotThrottled(email: string): Promise<void> {
    const requests = await this.redis.get(this.key(email));
    if (requests && Number(requests) >= MAX_REQUESTS) {
      throw new HttpException(
        'Too many password reset requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordRequest(email: string): Promise<void> {
    const key = this.key(email);
    const requests = await this.redis.incr(key);
    if (requests === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }
  }
}
