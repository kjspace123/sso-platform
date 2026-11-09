import type { Adapter, AdapterPayload } from 'oidc-provider';
import type { PrismaService } from '../database/prisma.service';
import type { SecretCipher } from '../common/crypto/secret-cipher';

/**
 * Read-only oidc-provider Adapter for the 'Client' model, backed by
 * Postgres (Application is the source of truth — section 6.5, section 15).
 * Applications are administered through AdminApplicationsController, not
 * oidc-provider's own dynamic client registration (which stays disabled),
 * so upsert/destroy/consume/revokeByGrantId are all no-ops here.
 */
export class ClientAdapter implements Adapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
  ) {}

  async find(clientId: string): Promise<AdapterPayload | undefined> {
    const application = await this.prisma.application.findUnique({
      where: { clientId },
      include: {
        redirectUris: true,
        postLogoutRedirectUris: true,
        clientSecrets: {
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        },
      },
    });

    // Disabled applications simply don't resolve as a client — oidc-provider
    // then rejects the request as invalid_client (section 16: "Application
    // disable checks").
    if (!application || application.status !== 'ACTIVE') return undefined;

    const isPublic = application.type === 'PUBLIC';

    return {
      client_id: application.clientId,
      client_name: application.name,
      redirect_uris: application.redirectUris.map((u) => u.redirectUri),
      post_logout_redirect_uris: application.postLogoutRedirectUris.map((u) => u.redirectUri),
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: isPublic ? 'none' : 'client_secret_basic',
      // Only confidential clients get a secret; oidc-provider's built-in
      // client_secret_basic/post auth needs the actual value in memory to do
      // a constant-time compare against what the client presents — see
      // common/crypto/secret-cipher.ts for why this is encrypted, not hashed,
      // at rest.
      ...(isPublic
        ? {}
        : { client_secret: this.decryptActiveSecret(application.clientSecrets) }),
    };
  }

  private decryptActiveSecret(secrets: { secretCiphertext: string }[]): string | undefined {
    const latest = secrets.at(-1);
    return latest ? this.cipher.decrypt(latest.secretCiphertext) : undefined;
  }

  async findByUid(): Promise<AdapterPayload | undefined> {
    return undefined;
  }

  async findByUserCode(): Promise<AdapterPayload | undefined> {
    return undefined;
  }

  async upsert(): Promise<void> {
    // Dynamic client registration is disabled; applications are created via
    // AdminApplicationsController -> ApplicationsService instead.
  }

  async consume(): Promise<void> {}

  async destroy(): Promise<void> {}

  async revokeByGrantId(): Promise<void> {}
}
