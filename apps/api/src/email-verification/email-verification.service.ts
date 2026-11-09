import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, email: string, enforceCooldown = false): Promise<string> {
    const now = new Date();
    if (enforceCooldown) {
      const recent = await this.prisma.emailVerificationToken.findFirst({
        where: { userId, email, createdAt: { gt: new Date(now.getTime() - RESEND_COOLDOWN_MS) } },
        select: { id: true },
      });
      if (recent) {
        throw new HttpException(
          'Please wait before requesting another verification email',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId,
          email,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
        },
      }),
    ]);
    return token;
  }

  /** Atomically consumes a token and verifies only the email it was issued for. */
  async consume(token: string): Promise<{ userId: string; email: string } | null> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { email: true, pendingEmail: true } } },
    });
    if (
      !record ||
      record.usedAt ||
      record.expiresAt <= new Date() ||
      (record.user.pendingEmail ?? record.user.email) !== record.email
    )
      return null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize verification against concurrent profile/email changes.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${record.userId} FOR UPDATE`;
        const user = await tx.user.findUniqueOrThrow({ where: { id: record.userId } });
        if ((user.pendingEmail ?? user.email) !== record.email) return null;
        const consumed = await tx.emailVerificationToken.updateMany({
          where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (consumed.count !== 1) return null;

        await tx.user.update({
          where: { id: record.userId },
          data: { email: record.email, pendingEmail: null, emailVerified: true },
        });
        await tx.emailVerificationToken.updateMany({
          where: { userId: record.userId, usedAt: null },
          data: { usedAt: new Date() },
        });
        // Links delivered to the previous address must not recover this account.
        await tx.passwordResetToken.updateMany({
          where: { userId: record.userId, usedAt: null },
          data: { usedAt: new Date() },
        });
        return { userId: record.userId, email: record.email };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }
}
