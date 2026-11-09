import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { PublicSession } from '@sso-platform/types';
import type { Session, User } from '@prisma/client';

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
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateSessionInput) {
    return this.prisma.session.create({
      data: {
        userId: input.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceName: input.deviceName,
        expiresAt: new Date(Date.now() + input.ttlSeconds * 1000),
      },
    });
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
    await this.prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  /** Logout from all devices (section 3.1). Optionally keep one session (the caller's) alive. */
  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
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
