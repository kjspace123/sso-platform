import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Env } from '@sso-platform/config';
import { AUDIT_ACTIONS } from '@sso-platform/types';
import { ENV } from '../config/env.module';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordResetService } from '../password-reset/password-reset.service';
import { SessionsService } from '../sessions/sessions.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordService } from './password.service';

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly passwordReset: PasswordResetService,
    private readonly audit: AuditService,
    private readonly throttle: LoginThrottleService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(email: string, password: string, ctx: RequestContext) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await this.passwords.hash(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
    });

    await this.audit.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
    });

    return this.startSession(user.id, ctx);
  }

  async login(email: string, password: string, ctx: RequestContext) {
    const ipKey = ctx.ipAddress ?? 'unknown';
    await this.throttle.assertNotThrottled(email, ipKey);

    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = user ? await this.passwords.verify(user.passwordHash, password) : false;

    if (!user || !valid) {
      await this.throttle.recordFailure(email, ipKey);
      await this.audit.record({
        actorId: user?.id ?? null,
        action: AUDIT_ACTIONS.USER_LOGIN_FAILED,
        resourceType: 'User',
        resourceId: user?.id,
        ipAddress: ctx.ipAddress,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.throttle.reset(email, ipKey);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await this.audit.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
    });

    return this.startSession(user.id, ctx);
  }

  private async startSession(userId: string, ctx: RequestContext) {
    return this.sessions.create({
      userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      // SSO browser session TTL: kept distinct from access token TTL (section 13).
      ttlSeconds: this.env.REFRESH_TOKEN_TTL,
    });
  }

  async logout(sessionId: string, actorId: string, ctx: RequestContext) {
    await this.sessions.revoke(sessionId);
    await this.audit.record({
      actorId,
      action: AUDIT_ACTIONS.USER_LOGOUT,
      resourceType: 'Session',
      resourceId: sessionId,
      ipAddress: ctx.ipAddress,
    });
  }

  async logoutAll(userId: string, currentSessionId: string, ctx: RequestContext) {
    await this.sessions.revokeAllForUser(userId);
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.USER_LOGOUT_ALL,
      resourceType: 'User',
      resourceId: userId,
      ipAddress: ctx.ipAddress,
    });
  }

  async forgotPassword(email: string, ctx: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always behave the same whether or not the account exists — don't leak
    // account existence via response timing/shape.
    if (!user) return;

    const token = await this.passwordReset.createToken(user.id);
    await this.audit.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
    });

    // TODO(Phase 3): wire to SMTP (section 24: SMTP_HOST/PORT/USER/PASSWORD).
    // Logged only in non-production so local dev/testing can complete the flow.
    if (this.env.NODE_ENV !== 'production') {
      console.log(`[dev] Password reset token for ${email}: ${token}`);
    }
  }

  async resetPassword(token: string, newPassword: string, ctx: RequestContext): Promise<void> {
    const userId = await this.passwordReset.consume(token);
    if (!userId) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.sessions.revokeAllForUser(userId);

    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
      resourceType: 'User',
      resourceId: userId,
      ipAddress: ctx.ipAddress,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      resourceType: 'User',
      resourceId: userId,
      ipAddress: ctx.ipAddress,
    });
  }
}
