import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "demo_b_session";

/**
 * Local logout only — ends this app's own session without touching the SSO
 * browser session, matching how most relying parties behave (signing out of
 * one app doesn't force-sign-out every other app using the same SSO).
 */
export async function GET(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
