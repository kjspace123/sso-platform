import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { REDIS } from '../database/redis.module';
import type { PublicSession } from '@sso-platform/types';
import type { Session, User } from '@prisma/client';
import type Redis from 'ioredis';
import { revokeOidcAccount } from '../oidc/redis-adapter';
import { createSessionToken, hashSessionToken } from './session-token';

export interface CreateSessionInput {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
  ttlSeconds: number;
}

/** Owns the SSO browser session lifecycle (section 13 / section 19 Phase 3). */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async create(input: CreateSessionInput) {
    const token = createSessionToken();
    const session = await this.prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId: input.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceName: input.deviceName,
        expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
      },
    });
    // The bearer token is returned only to the login controller, never in a DTO.
    return { ...session, token };
  }

  findById(id: string) {
    return this.prisma.session.findUnique({ where: { id } });
  }

  listActiveForUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /** Platform-wide session list for the admin portal (section 2.2: "View active sessions"). */
  async listAll(params: { page: number; pageSize: number; activeOnly: boolean }) {
    const { page, pageSize, activeOnly } = params;
    const where = activeOnly ? { revokedAt: null, expiresAt: { gt: new Date() } } : {};
    const [items, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: { user: true },
        orderBy: { lastSeenAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.session.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async revoke(id: string) {
    const session = await this.prisma.session.findUnique({ where: { id }, select: { userId: true } });
    if (!session) return;
    await this.prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
    await revokeOidcAccount(this.redis, session.userId);
  }

  /** Logout from all devices (section 3.1). Optionally keep one session (the caller's) alive. */
  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
    await revokeOidcAccount(this.redis, userId);
  }

  toPublic(session: Session, currentSessionId?: string): PublicSession {
    return {
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceName: session.deviceName,
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
      current: currentSessionId ? session.id === currentSessionId : undefined,
    };
  }

  toPublicWithUser(session: Session & { user: User }): PublicSession {
    return { ...this.toPublic(session), userEmail: session.user.email };
  }
}
