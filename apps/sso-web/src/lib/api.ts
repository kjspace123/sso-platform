function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var ${name} — see .env.example`);
  return value;
}

// Lazy getter (not a top-level const) so a missing var throws when this is
// actually used, not at module-import time for every page that transitively
// imports this file — same pattern as demo-app-a/b's lib/config.ts. Without
// this, a build that forgot to pass NEXT_PUBLIC_API_URL as a Docker build
// arg would silently ship a bundle that calls http://localhost:4000 from a
// real user's browser instead of failing loudly.
function getApiBase(): string {
  return required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Thin fetch wrapper for the SSO backend. Always sends cookies (the SSO
 * browser session, section 13) and surfaces the API's error envelope
 * (statusCode/error/message — see @sso-platform/types ApiErrorBody).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(", ") : (body?.message ?? res.statusText);
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}
