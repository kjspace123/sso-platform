import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSafeReturnTo } from '../dist/return-to.js';

const origin = 'https://sso.example.com';
const allowed = ['https://admin.example.com'];

test('accepts same-origin paths and explicitly allowed origins', () => {
  assert.equal(resolveSafeReturnTo('/profile?tab=security', origin, allowed), `${origin}/profile?tab=security`);
  assert.equal(
    resolveSafeReturnTo('https://admin.example.com/users', origin, allowed),
    'https://admin.example.com/users',
  );
});

test('rejects executable, credentialed, protocol-relative, and unknown destinations', () => {
  const fallback = `${origin}/profile`;
  assert.equal(resolveSafeReturnTo('javascript:alert(1)', origin, allowed), fallback);
  assert.equal(resolveSafeReturnTo('https://user:pass@admin.example.com', origin, allowed), fallback);
  assert.equal(resolveSafeReturnTo('//evil.example.com', origin, allowed), fallback);
  assert.equal(resolveSafeReturnTo('//admin.example.com/users', origin, allowed), fallback);
  assert.equal(resolveSafeReturnTo('https://evil.example.com', origin, allowed), fallback);
});
