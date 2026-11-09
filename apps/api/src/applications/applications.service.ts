import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { SECRET_CIPHER } from '../common/crypto/crypto.module';
import type { SecretCipher } from '../common/crypto/secret-cipher';
import type { CreateApplicationInput, UpdateApplicationInput } from '@sso-platform/validation';
import type { PublicApplication } from '@sso-platform/types';
import type { Application, ApplicationRedirectUri, ApplicationPostLogoutRedirectUri } from '@prisma/client';

type ApplicationWithUris = Application & {
  redirectUris: ApplicationRedirectUri[];
  postLogoutRedirectUris: ApplicationPostLogoutRedirectUri[];
};

function generateClientId(): string {
  return randomBytes(16).toString('hex');
}

function generateClientSecret(): string {
  return randomBytes(32).toString('base64url');
}

const include = { redirectUris: true, postLogoutRedirectUris: true } as const;

/**
 * OAuth client application management (section 15). Client secret
 * verification and redirect_uri validation for the actual OIDC flow live in
 * apps/api/src/oidc/client-adapter.ts, not here — this service is the admin
 * CRUD surface only (see apps/api/src/admin/admin-applications.controller.ts).
 */
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  async create(input: CreateApplicationInput): Promise<{ application: ApplicationWithUris; clientSecret?: string }> {
    const clientId = generateClientId();
    const clientSecret = input.type === 'CONFIDENTIAL' ? generateClientSecret() : undefined;

    const application = await this.prisma.application.create({
      data: {
        name: input.name,
        type: input.type,
        clientId,
        redirectUris: { create: input.redirectUris.map((redirectUri) => ({ redirectUri })) },
        postLogoutRedirectUris: {
          create: input.postLogoutRedirectUris.map((redirectUri) => ({ redirectUri })),
        },
        ...(clientSecret
          ? { clientSecrets: { create: { secretCiphertext: this.cipher.encrypt(clientSecret) } } }
          : {}),
      },
      include,
    });

    // Client secret is returned once, at creation time, and never again (section 15).
    return { application, clientSecret };
  }

  list() {
    return this.prisma.application.findMany({ include, orderBy: { createdAt: 'desc' } });
  }

  async findByIdOrThrow(id: string): Promise<ApplicationWithUris> {
    const application = await this.prisma.application.findUnique({ where: { id }, include });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async update(id: string, input: UpdateApplicationInput) {
    await this.findByIdOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      if (input.redirectUris) {
        await tx.applicationRedirectUri.deleteMany({ where: { applicationId: id } });
        await tx.applicationRedirectUri.createMany({
          data: input.redirectUris.map((redirectUri) => ({ applicationId: id, redirectUri })),
        });
      }
      if (input.postLogoutRedirectUris) {
        await tx.applicationPostLogoutRedirectUri.deleteMany({ where: { applicationId: id } });
        await tx.applicationPostLogoutRedirectUri.createMany({
          data: input.postLogoutRedirectUris.map((redirectUri) => ({ applicationId: id, redirectUri })),
        });
      }
      return tx.application.update({
        where: { id },
        data: { name: input.name },
        include,
      });
    });
  }

  async disable(id: string) {
    await this.findByIdOrThrow(id);
    return this.prisma.application.update({ where: { id }, data: { status: 'DISABLED' }, include });
  }

  async enable(id: string) {
    await this.findByIdOrThrow(id);
    return this.prisma.application.update({ where: { id }, data: { status: 'ACTIVE' }, include });
  }

  /** Rotates the client secret. The old one is revoked, not deleted, for audit continuity. */
  async rotateSecret(id: string): Promise<string> {
    const application = await this.findByIdOrThrow(id);
    if (application.type === 'PUBLIC') throw new BadRequestException('Public clients do not use client secrets');
    const clientSecret = generateClientSecret();

    await this.prisma.$transaction([
      this.prisma.clientSecret.updateMany({
        where: { applicationId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.clientSecret.create({
        data: { applicationId: id, secretCiphertext: this.cipher.encrypt(clientSecret) },
      }),
    ]);

    return clientSecret;
  }

  toPublic(application: ApplicationWithUris): PublicApplication {
    if (!application.redirectUris) throw new ConflictException('Application missing redirect URIs');
    return {
      id: application.id,
      name: application.name,
      clientId: application.clientId,
      status: application.status,
      type: application.type,
      redirectUris: application.redirectUris.map((u) => u.redirectUri),
      postLogoutRedirectUris: application.postLogoutRedirectUris.map((u) => u.redirectUri),
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }
}
