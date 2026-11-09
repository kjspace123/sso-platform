import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { REDIS } from '../database/redis.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check() {
    try {
      await Promise.all([this.prisma.$queryRaw`SELECT 1`, this.redis.ping()]);
      return { status: 'ok', dependencies: { postgres: 'ok', redis: 'ok' }, timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException('A required dependency is unavailable');
    }
  }
}
