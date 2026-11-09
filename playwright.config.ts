import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'pnpm --filter @sso-platform/api start', url: 'http://localhost:4000/health', reuseExistingServer: false },
    { command: 'pnpm --filter @sso-platform/sso-web start', url: 'http://localhost:3000', reuseExistingServer: false },
    {
      command: 'pnpm --filter @sso-platform/demo-app-a start', url: 'http://localhost:3002', reuseExistingServer: false,
      env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3002', OIDC_CLIENT_ID: 'browser-app-a', OIDC_CLIENT_SECRET: 'browser-only-a', COOKIE_SECURE: 'false' },
    },
    {
      command: 'pnpm --filter @sso-platform/demo-app-b start', url: 'http://localhost:3003', reuseExistingServer: false,
      env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3003', OIDC_CLIENT_ID: 'browser-app-b', OIDC_CLIENT_SECRET: 'browser-only-b', COOKIE_SECURE: 'false' },
    },
  ],
});
