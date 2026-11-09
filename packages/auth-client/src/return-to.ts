/**
 * Resolves an untrusted post-authentication destination against an explicit
 * origin allowlist. Only HTTP(S) URLs without embedded credentials are valid.
 */
export function resolveSafeReturnTo(
  value: string | null,
  currentOrigin: string,
  allowedOrigins: string[] = [],
  fallback = '/profile',
): string {
  const fallbackUrl = new URL(fallback, currentOrigin);
  if (!value) return fallbackUrl.toString();
  const trimmed = value.trim();
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) return fallbackUrl.toString();

  try {
    const target = new URL(trimmed, currentOrigin);
    const allowed = new Set([currentOrigin, ...allowedOrigins]);
    if (
      (target.protocol !== 'http:' && target.protocol !== 'https:') ||
      target.username ||
      target.password ||
      !allowed.has(target.origin)
    ) {
      return fallbackUrl.toString();
    }
    return target.toString();
  } catch {
    return fallbackUrl.toString();
  }
}
