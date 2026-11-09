import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';

const TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes — section 12

function hashToken(token: string): string {
  // Reset tokens are single-use, short-lived, and high entropy — a fast
  // hash (not Argon2id) is fine and keeps lookups cheap (section 6.8).
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  constructor(private readonly prisma: PrismaService) {}

  async createToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000),
      },
    });
    return token;
  }

  /** Validates a token without consuming it. Returns the owning userId, or null. */
  async validate(token: string): Promise<string | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) return null;
    return record.userId;
  }

  /** Marks the token used. Reused tokens must fail (section 21: "Password reset token reuse"). */
  async consume(token: string): Promise<string | null> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) return null;

    const consumed = await this.prisma.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) return null;
    return record.userId;
  }
}
