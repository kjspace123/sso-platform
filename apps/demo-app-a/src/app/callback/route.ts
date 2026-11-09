import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { oidcConfig } from "@/lib/config";
import { encodeSession } from "@/lib/session-cookie";

const PENDING_COOKIE = "demo_a_pending";
const SESSION_COOKIE = "demo_a_session";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

const jwks = createRemoteJWKSet(new URL("/jwks", oidcConfig.issuer));

function errorRedirect(req: NextRequest, error: string, description: string) {
  const url = new URL("/error", req.url);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  const response = NextResponse.redirect(url);
  response.cookies.delete(PENDING_COOKIE);
  return response;
}

/** Completes the Authorization Code + PKCE flow (section 11.1). */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const oauthError = params.get("error");
  if (oauthError) {
    return errorRedirect(req, oauthError, params.get("error_description") ?? "Sign-in was not completed.");
  }

  const code = params.get("code");
  const state = params.get("state");
  const pendingRaw = req.cookies.get(PENDING_COOKIE)?.value;
  if (!code || !state || !pendingRaw) {
    return errorRedirect(req, "invalid_request", "Missing code, state, or the pending sign-in cookie.");
  }

  const pending = JSON.parse(pendingRaw) as { verifier: string; state: string; nonce: string };
  if (state !== pending.state) {
    return errorRedirect(req, "invalid_state", "State did not match — possible CSRF, aborting.");
  }

  const tokenRes = await fetch(new URL("/token", oidcConfig.issuer), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${oidcConfig.clientId}:${oidcConfig.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: oidcConfig.redirectUri,
      code_verifier: pending.verifier,
    }),
  });

  const tokens = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok) {
    return errorRedirect(req, tokens.error ?? "token_exchange_failed", tokens.error_description ?? "Token exchange failed.");
  }

  // Verify the ID token's signature against the issuer's published JWKS
  // (not just decode it) — this is what actually proves it came from the SSO
  // provider and wasn't tampered with.
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: oidcConfig.issuer,
    audience: oidcConfig.clientId,
  });

  if (payload.nonce !== pending.nonce) {
    return errorRedirect(req, "invalid_nonce", "ID token nonce did not match the sign-in request.");
  }

  // With the Authorization Code flow (an access token is issued), OIDC
  // expects scope-derived claims like email to come from userinfo, not be
  // embedded in the ID token — the ID token here only carries `sub` and
  // auth-context claims. See section 17: the API's /me endpoint.
  const userinfoRes = await fetch(new URL("/me", oidcConfig.issuer), {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userinfo = (await userinfoRes.json()) as { sub: string; email?: string; email_verified?: boolean };

  const sessionValue = encodeSession({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    claims: {
      sub: payload.sub as string,
      email: userinfo.email,
      email_verified: userinfo.email_verified,
    },
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });

  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.delete(PENDING_COOKIE);
  response.cookies.set(SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // demo app's own session cookie lifetime, independent of the access token's
    path: "/",
  });
  return response;
}
