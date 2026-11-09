import { resolveSafeReturnTo as resolveAllowlistedReturnTo } from "@sso-platform/auth-client";

const configuredOrigins = (process.env.NEXT_PUBLIC_ALLOWED_RETURN_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Resolves an untrusted returnTo query parameter against an explicit origin
 * allowlist. Only HTTP(S) URLs are accepted; malformed values, protocol-relative
 * URLs, credentials in URLs, and unknown origins fall back to the profile page.
 */
export function resolveSafeReturnTo(value: string | null, currentOrigin: string, fallback = "/profile"): string {
  return resolveAllowlistedReturnTo(value, currentOrigin, configuredOrigins, fallback);
}
