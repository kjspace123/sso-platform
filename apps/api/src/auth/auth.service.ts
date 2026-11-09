import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Env } from '@sso-platform/config';
import { AUDIT_ACTIONS } from '@sso-platform/types';
import { ENV } from '../config/env.module';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordResetService } from '../password-reset/password-reset.service';
import { PasswordResetMailerService } from '../password-reset/password-reset-mailer.service';
import { EmailVerificationMailerService } from '../email-verification/email-verification-mailer.service';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { SessionsService } from '../sessions/sessions.service';
import { LoginThrottleService } from './login-throttle.service';
import { PasswordResetThrottleService } from './password-reset-throttle.service';
import { PasswordService } from './password.service';

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly passwordReset: PasswordResetService,
    private readonly passwordResetMailer: PasswordResetMailerService,
    private readonly emailVerification: EmailVerificationService,
    private readonly emailVerificationMailer: EmailVerificationMailerService,
    private readonly audit: AuditService,
    private readonly throttle: LoginThrottleService,
    private readonly passwordResetThrottle: PasswordResetThrottleService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(email: string, password: string, ctx: RequestContext) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await this.passwords.hash(password);
    const defaultRole = await this.prisma.role.findUnique({
      where: { name: 'user' },
      select: { id: true },
    });
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        ...(defaultRole ? { roles: { create: { roleId: defaultRole.id } } } : {}),
      },
    });

    await this.audit.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      resourceType: 'User',
      resourceId: user.id,
      ipAddress: ctx.ipAddress,
    });

    await this.requestEmailVerification(user.id, user.email, ctx, false);

    return this.startSession(user.id, ctx);
  }

  async login(email: string, password: string, ctx: RequestContext) {
    const ipKey = ctx.ipAddress ?? 'unknown';
    await this.throttle.assertNotThrottled(email, ipKey);

    const user = await this.prisma.user.findUnique({ where: { email } });
    // verifyOrDummy always runs a real Argon2id verify (against a dummy hash
    // when the account doesn't exist) so this path's timing doesn't leak
    // account existence — see PasswordService.verifyOrDummy.
    const valid = await this.passwords.verifyOrDummy(user?.passwordHash, password);

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
    // Throttle applies before the existence check and regardless of outcome,
    // so the rate limit itself can't become a second account-existence
    // oracle (e.g. only real accounts ever getting throttled).
    await this.passwordResetThrottle.assertNotThrottled(email);
    await this.passwordResetThrottle.recordRequest(email);

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

    // Do not make account existence observable through SMTP response time.
    // Delivery is intentionally detached; failures are logged without tokens.
    void this.passwordResetMailer
      .send(email, token)
      .catch((error: unknown) =>
        this.logger.error(`Password reset email delivery failed for ${email}: ${error}`),
      );
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

  async resendEmailVerification(userId: string, ctx: RequestContext): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, pendingEmail: true, emailVerified: true },
    });
    if (!user || (user.emailVerified && !user.pendingEmail)) return;
    await this.requestEmailVerification(userId, user.pendingEmail ?? user.email, ctx, true);
  }

  async verifyEmail(token: string, ctx: RequestContext): Promise<void> {
    const verified = await this.emailVerification.consume(token);
    if (!verified) throw new BadRequestException('Invalid or expired email verification token');

    await this.audit.record({
      actorId: verified.userId,
      action: AUDIT_ACTIONS.EMAIL_VERIFIED,
      resourceType: 'User',
      resourceId: verified.userId,
      ipAddress: ctx.ipAddress,
    });
  }

  private async requestEmailVerification(
    userId: string,
    email: string,
    ctx: RequestContext,
    enforceCooldown: boolean,
  ): Promise<void> {
    const token = await this.emailVerification.issue(userId, email, enforceCooldown);
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.EMAIL_VERIFICATION_REQUESTED,
      resourceType: 'User',
      resourceId: userId,
      ipAddress: ctx.ipAddress,
    });
    void this.emailVerificationMailer
      .send(email, token)
      .catch((error: unknown) =>
        this.logger.error(`Email verification delivery failed for ${email}: ${error}`),
      );
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.sessions.revokeAllForUser(userId, currentSessionId);

    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      resourceType: 'User',
      resourceId: userId,
      ipAddress: ctx.ipAddress,
    });
  }
}
