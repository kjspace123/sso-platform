import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp } from './utils/test-app';
import { PrismaService } from '../src/database/prisma.service';

describe('Bootstrap preserves administrative changes', () => {
  let app: NestExpressApplication;
  afterAll(async () => { await app?.close(); });

  it('preserves existing role policy, disabled clients, rotated secrets, and removed admin access', async () => {
    app = await createTestApp(); const prisma = app.get(PrismaService);
    const suffix = randomUUID();
    const role = await prisma.role.findUniqueOrThrow({ where: { name: 'user' } });
    const permission = await prisma.permission.create({ data: { name: `custom:${suffix}` } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
    const clientId = `seed-${suffix}`;
    const client = await prisma.application.create({ data: {
      name: 'Operator edited client', clientId, status: 'DISABLED', type: 'CONFIDENTIAL',
      redirectUris: { create: { redirectUri: 'https://client.example.com/new-callback' } },
      clientSecrets: { create: { secretCiphertext: 'operator-rotated-secret-fixture' } },
    } });
    const user = await prisma.user.create({ data: { email: `former-admin-${suffix}@example.com`, passwordHash: 'unused-fixture' } });
    await promisify(execFile)(process.execPath, [
      resolve(dirname(require.resolve('ts-node/package.json')), 'dist/bin.js'),
      '--transpile-only', 'prisma/seed.ts',
    ], { cwd: resolve(__dirname, '..'), env: {
      ...process.env,
      SEED_DEMO_APP_A_CLIENT_ID: clientId, SEED_DEMO_APP_A_CLIENT_SECRET: 'bootstrap-secret',
      SEED_ADMIN_EMAIL: user.email, SEED_ADMIN_PASSWORD: 'bootstrap-password-never-used',
    } });
    expect(await prisma.rolePermission.findUnique({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } } })).not.toBeNull();
    const preserved = await prisma.application.findUniqueOrThrow({
      where: { id: client.id }, include: { clientSecrets: true, redirectUris: true },
    });
    expect(preserved.status).toBe('DISABLED');
    expect(preserved.name).toBe('Operator edited client');
    expect(preserved.clientSecrets[0]?.secretCiphertext).toBe('operator-rotated-secret-fixture');
    expect(preserved.redirectUris[0]?.redirectUri).toBe('https://client.example.com/new-callback');
    expect(await prisma.userRole.count({ where: { userId: user.id } })).toBe(0);
  }, 15000);
});
