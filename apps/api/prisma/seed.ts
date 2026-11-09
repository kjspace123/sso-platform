/**
 * Seeds baseline permissions and roles (section 10.3 / section 14 of the plan).
 * Run with: pnpm --filter @sso-platform/api exec prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createCipheriv, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function encryptClientSecret(base64Key: string, plaintext: string): string {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('CLIENT_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

const PERMISSIONS: Array<{ name: string; description: string }> = [
  { name: 'user:read', description: 'View user accounts' },
  { name: 'user:create', description: 'Create user accounts' },
  { name: 'user:update', description: 'Update user accounts' },
  { name: 'user:disable', description: 'Enable or disable user accounts' },

  { name: 'application:read', description: 'View OAuth client applications' },
  { name: 'application:create', description: 'Register OAuth client applications' },
  { name: 'application:update', description: 'Update OAuth client applications' },
  { name: 'application:disable', description: 'Enable or disable OAuth client applications' },

  { name: 'session:read', description: 'View active sessions' },
  { name: 'session:revoke', description: 'Revoke active sessions' },

  { name: 'role:read', description: 'View roles and permissions' },
  { name: 'role:update', description: 'Assign roles and permissions' },

  { name: 'audit:read', description: 'View audit logs' },
];

const ROLES: Array<{ name: string; description: string; permissions: string[] }> = [
  {
    name: 'super-admin',
    description: 'Full administrative access',
    permissions: PERMISSIONS.map((p) => p.name),
  },
  {
    name: 'admin',
    description: 'Operational administration',
    permissions: ['user:read', 'user:update', 'application:read', 'session:revoke'],
  },
  {
    name: 'user',
    description: 'Standard authenticated user',
    permissions: [],
  },
];

async function seedDemoApplication(input: {
  name: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}) {
  if (!input.clientId || !input.clientSecret) return;
  const encryptionKey = process.env.CLIENT_SECRET_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('CLIENT_SECRET_ENCRYPTION_KEY is required to seed demo applications');

  // Bootstrap only: a restart must never undo rotation, disablement, or URIs.
  await prisma.application.upsert({
    where: { clientId: input.clientId },
    update: {},
    create: {
      name: input.name, clientId: input.clientId, status: 'ACTIVE', type: 'CONFIDENTIAL',
      redirectUris: { create: { redirectUri: input.redirectUri } },
      postLogoutRedirectUris: { create: { redirectUri: input.postLogoutRedirectUri } },
      clientSecrets: { create: { secretCiphertext: encryptClientSecret(encryptionKey, input.clientSecret) } },
    },
  });
  console.log(`Seeded OIDC client: ${input.name}`);
}

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of ROLES) {
    const permissions = await prisma.permission.findMany({ where: { name: { in: role.permissions } } });
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        name: role.name,
        description: role.description,
        permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
      },
    });
  }

  await seedDemoApplication({
    name: 'Demo App A',
    clientId: process.env.SEED_DEMO_APP_A_CLIENT_ID,
    clientSecret: process.env.SEED_DEMO_APP_A_CLIENT_SECRET,
    redirectUri: process.env.SEED_DEMO_APP_A_REDIRECT_URI ?? 'http://localhost:3002/callback',
    postLogoutRedirectUri: process.env.SEED_DEMO_APP_A_POST_LOGOUT_URI ?? 'http://localhost:3002',
  });
  await seedDemoApplication({
    name: 'Demo App B',
    clientId: process.env.SEED_DEMO_APP_B_CLIENT_ID,
    clientSecret: process.env.SEED_DEMO_APP_B_CLIENT_SECRET,
    redirectUri: process.env.SEED_DEMO_APP_B_REDIRECT_URI ?? 'http://localhost:3003/callback',
    postLogoutRedirectUri: process.env.SEED_DEMO_APP_B_POST_LOGOUT_URI ?? 'http://localhost:3003',
  });

  // Optional local-dev super admin, controlled by env so it's never seeded in CI/prod by accident.
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedAdminEmail && seedAdminPassword) {
    const passwordHash = await argon2.hash(seedAdminPassword, { type: argon2.argon2id });
    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super-admin' } });
    await prisma.user.upsert({
      where: { email: seedAdminEmail },
      update: {},
      create: {
        email: seedAdminEmail,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        roles: { create: { roleId: superAdminRole.id } },
      },
    });

    console.log(`Seeded super-admin user: ${seedAdminEmail}`);
  } else {
    console.log('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping local admin user seed.');
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
