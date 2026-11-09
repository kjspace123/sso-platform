import { Module } from '@nestjs/common';
import { RequestRateLimiter } from './request-rate-limiter';

@Module({ providers: [RequestRateLimiter], exports: [RequestRateLimiter] })
export class SecurityModule {}
