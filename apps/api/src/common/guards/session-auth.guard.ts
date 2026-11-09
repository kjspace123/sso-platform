import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';

export const SSO_SESSION_COOKIE = 'sso_session';

/**
 * Resolves the SSO browser session cookie (section 13) into `request.user`.
 * Rejects disabled accounts, revoked sessions, and expired sessions
 * (section 16: "Account disable checks", "Session revocation").
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const sessionId = request.cookies?.[SSO_SESSION_COOKIE] as string | undefined;
    if (!sessionId) throw new UnauthorizedException('No active session');

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is invalid or expired');
    }
    if (session.user.status === 'DISABLED') {
      throw new UnauthorizedException('Account is disabled');
    }

    const permissions = session.user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.name),
    );

    request.user = {
      id: session.user.id,
      email: session.user.email,
      sessionId: session.id,
      permissions: [...new Set(permissions)],
    };

    // Sliding last-seen — cheap and gives session lists an accurate signal.
    void this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });

    return true;
  }
}
