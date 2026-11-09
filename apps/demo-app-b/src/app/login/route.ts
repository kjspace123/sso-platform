import { NextResponse } from "next/server";
import { buildAuthorizeUrl, generateCodeChallenge, generateCodeVerifier, generateNonce, generateState } from "@sso-platform/auth-client";
import { oidcConfig } from "@/lib/config";

const PENDING_COOKIE = "demo_b_pending";

/** Starts the Authorization Code + PKCE flow (section 11.1). */
export async function GET() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();
  const nonce = generateNonce();

  const authorizeUrl = buildAuthorizeUrl({
    issuer: oidcConfig.issuer,
    clientId: oidcConfig.clientId,
    redirectUri: oidcConfig.redirectUri,
    state,
    nonce,
    codeChallenge: challenge,
  });

  const response = NextResponse.redirect(authorizeUrl);
  // Short-lived, single-use — just carries the PKCE verifier + state/nonce
  // across the redirect round trip to /callback for verification there.
  response.cookies.set(PENDING_COOKIE, JSON.stringify({ verifier, state, nonce }), {
    httpOnly: true,
    secure: oidcConfig.secureCookies,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
