import { createApplicationSchema } from '@sso-platform/validation';

const application = {
  name: 'Test client',
  type: 'CONFIDENTIAL' as const,
  postLogoutRedirectUris: [],
};

describe('application redirect URI validation', () => {
  it('accepts HTTPS and localhost development callbacks', () => {
    expect(
      createApplicationSchema.safeParse({ ...application, redirectUris: ['https://app.example.com/callback'] }).success,
    ).toBe(true);
    expect(
      createApplicationSchema.safeParse({ ...application, redirectUris: ['http://app-a.localhost/callback'] }).success,
    ).toBe(true);
    expect(
      createApplicationSchema.safeParse({ ...application, redirectUris: ['http://app-a.sso.test/callback'] }).success,
    ).toBe(true);
  });

  it('rejects executable, credentialed, insecure remote, and duplicate callbacks', () => {
    for (const redirectUris of [
      ['javascript:alert(1)'],
      ['https://user:password@app.example.com/callback'],
      ['http://app.example.com/callback'],
      ['https://app.example.com/callback', 'https://app.example.com/callback'],
    ]) {
      expect(createApplicationSchema.safeParse({ ...application, redirectUris }).success).toBe(false);
    }
  });
});
