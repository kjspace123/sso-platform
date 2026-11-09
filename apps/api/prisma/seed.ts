/**
 * Seeds baseline permissions and roles (section 10.3 / section 14 of the plan).
 * Run with: pnpm --filter @sso-platform/api exec prisma db seed
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

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

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });

    const permissions = await prisma.permission.findMany({
      where: { name: { in: role.permissions } },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    if (permissions.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: created.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }

  // Optional local-dev super admin, controlled by env so it's never seeded in CI/prod by accident.
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedAdminEmail && seedAdminPassword) {
    const passwordHash = await argon2.hash(seedAdminPassword, { type: argon2.argon2id });
    const admin = await prisma.user.upsert({
      where: { email: seedAdminEmail },
      update: {},
      create: {
        email: seedAdminEmail,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'super-admin' } });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdminRole.id },
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
