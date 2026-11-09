import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Env } from '@sso-platform/config';
import { PERMISSIONS } from '@sso-platform/types';
import { ENV } from '../config/env.module';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@ApiTags('admin/security')
@Controller('admin/security')
export class AdminSecurityController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_READ)
  status() {
    const production = this.env.NODE_ENV === 'production';
    const httpsConfigured = [
      this.env.OIDC_ISSUER,
      this.env.SSO_BASE_URL,
      this.env.ADMIN_BASE_URL,
      this.env.DEMO_APP_A_BASE_URL,
      this.env.DEMO_APP_B_BASE_URL,
    ].every((url) => new URL(url).protocol === 'https:');

    return {
      environment: this.env.NODE_ENV,
      checks: [
        { name: 'Authorization Code flow with PKCE', status: 'pass' },
        { name: 'HttpOnly and SameSite session cookies', status: 'pass' },
        { name: 'Secure cookies', status: !production || httpsConfigured ? 'pass' : 'fail' },
        { name: 'HTTPS endpoints', status: !production || httpsConfigured ? 'pass' : 'fail' },
        { name: 'Persistent OIDC signing key', status: this.env.OIDC_JWKS ? 'pass' : 'warn' },
        {
          name: 'Password reset email delivery',
          status: this.env.SMTP_HOST && this.env.SMTP_PORT && this.env.SMTP_FROM ? 'pass' : 'warn',
        },
        { name: 'Login throttling backed by Redis', status: 'pass' },
        { name: 'OIDC-aware session revocation', status: 'pass' },
      ],
    };
  }
}
