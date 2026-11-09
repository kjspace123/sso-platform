import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('registers through App A, reuses SSO in App B, and requires login after central logout', async ({ page, context }) => {
  const email = `browser-${randomUUID()}@example.com`;
  await page.goto('http://localhost:3002');
  await page.getByRole('link', { name: 'Continue with SSO' }).click();
  await expect(page).toHaveURL(/localhost:3000\/login\?interaction=/);
  await page.getByRole('link', { name: 'Create one' }).click();
  await expect(page).toHaveURL(/localhost:3000\/register\?interaction=/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-Battery-Staple-1!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/localhost:3000\/consent\?interaction=/);
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3002/');
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  const destinations: string[] = [];
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) destinations.push(frame.url()); });
  await page.goto('http://localhost:3003');
  await page.getByRole('link', { name: 'Continue with SSO' }).click();
  await expect(page).toHaveURL(/localhost:3000\/consent\?interaction=/);
  expect(destinations.some((url) => new URL(url).pathname === '/login' && new URL(url).port === '3000')).toBe(false);
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3003/');
  await expect(page.getByText(email, { exact: true })).toBeVisible();

  const logout = await context.request.post('http://localhost:4000/api/auth/logout-all', {
    headers: { Origin: 'http://localhost:3000' },
  });
  expect(logout.status()).toBe(204);
  await page.goto('http://localhost:3003/logout');
  await page.getByRole('link', { name: 'Continue with SSO' }).click();
  await expect(page).toHaveURL(/localhost:3000\/login\?interaction=/);
});

test('rejects a callback without a matching pending sign-in', async ({ page }) => {
  await page.goto('http://localhost:3002/callback?code=untrusted&state=untrusted');
  await expect(page).toHaveURL(/\/error\?error=invalid_request/);
});

test('demo redirects use the configured origin behind a proxy', async ({ request }) => {
  for (const port of [3002, 3003]) {
    const origin = `http://localhost:${port}`;
    for (const path of ['/logout', '/callback']) {
      const response = await request.get(origin + path, {
        headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'untrusted.example' },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(307);
      const destination = new URL(response.headers().location);
      expect(destination.origin).toBe(origin);
      expect(destination.pathname).toBe(path === '/logout' ? '/' : '/error');
    }
  }
});
