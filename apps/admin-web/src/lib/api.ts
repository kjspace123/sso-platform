const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const SSO_WEB_URL = process.env.NEXT_PUBLIC_SSO_WEB_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Same contract as the sso-web client — see @sso-platform/types ApiErrorBody. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
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
