import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AuditAction } from '@sso-platform/types';

export interface RecordAuditEventInput {
  actorId?: string | null;
  action: AuditAction | string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Central audit sink (section 18). Every important state change should go
 * through here rather than writing AuditLog rows ad hoc, so redaction and
 * shape stay consistent.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput) {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ipAddress: input.ipAddress ?? null,
        // Never pass raw secrets/tokens into metadata — callers are responsible
        // for only including non-sensitive context (section 25).
        metadata: input.metadata as never,
      },
    });
  }

  async list(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, pageSize };
  }
}
