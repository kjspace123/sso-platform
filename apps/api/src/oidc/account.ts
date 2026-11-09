import type { Account, FindAccount } from 'oidc-provider';
import type { PrismaService } from '../database/prisma.service';

/**
 * Resolves an oidc-provider accountId (our User.id) to account claims
 * (section 19 Phase 4: "Implement account resolution"). Only exposes claims
 * the requested scope actually grants — 'openid' always yields `sub`;
 * 'email' additionally yields email/email_verified.
 */
export function createFindAccount(prisma: PrismaService): FindAccount {
  return async (_ctx, sub): Promise<Account | undefined> => {
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || user.status !== 'ACTIVE') return undefined;

    return {
      accountId: user.id,
      async claims(_use, scope) {
        const scopes = new Set(scope.split(' '));
        return {
          sub: user.id,
          ...(scopes.has('email') ? { email: user.email, email_verified: user.emailVerified } : {}),
        };
      },
    };
  };
}
