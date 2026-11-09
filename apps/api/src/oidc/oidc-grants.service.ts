import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import type { ConnectedApplication } from '@sso-platform/types';
import { REDIS } from '../database/redis.module';
import { PrismaService } from '../database/prisma.service';
import { findOidcGrantsForAccount, revokeOidcGrant } from './redis-adapter';

@Injectable()
export class OidcGrantsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async listForAccount(accountId: string): Promise<ConnectedApplication[]> {
    const grants = await findOidcGrantsForAccount(this.redis, accountId);
    const clientIds = [...new Set(grants.map((grant) => grant.payload.clientId).filter((id): id is string => !!id))];
    if (clientIds.length === 0) return [];

    const applications = await this.prisma.application.findMany({ where: { clientId: { in: clientIds } } });
    return applications.map((application) => {
      const applicationGrants = grants.filter((grant) => grant.payload.clientId === application.clientId);
      const grantedAt = Math.max(...applicationGrants.map((grant) => grant.payload.iat ?? 0));
      const scopes = new Set<string>();
      for (const grant of applicationGrants) {
        const openid = (grant.payload as typeof grant.payload & { openid?: { scope?: string } }).openid;
        for (const scope of openid?.scope?.split(' ') ?? []) scopes.add(scope);
      }
      return {
        id: application.id,
        name: application.name,
        clientId: application.clientId,
        status: application.status,
        scopes: [...scopes].sort(),
        grantedAt: grantedAt > 0 ? new Date(grantedAt * 1000).toISOString() : null,
      };
    });
  }

  async revokeForApplication(accountId: string, applicationId: string): Promise<void> {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) throw new NotFoundException('Application not found');

    const grants = await findOidcGrantsForAccount(this.redis, accountId);
    const matching = grants.filter((grant) => grant.payload.clientId === application.clientId);
    await Promise.all(matching.map((grant) => revokeOidcGrant(this.redis, accountId, grant.id)));
  }
}
