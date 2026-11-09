import { cookies } from "next/headers";
import { decodeSession } from "@/lib/session-cookie";

export default async function Home() {
  const session = decodeSession((await cookies()).get("demo_a_session")?.value);

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-blue-50 px-4 text-center">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
        A
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-blue-950">Demo App A</h1>

      {session ? (
        <>
          <p className="mt-2 max-w-md text-sm text-blue-900/70">
            Signed in as <span className="font-medium text-blue-950">{session.claims.email ?? session.claims.sub}</span>{" "}
            via the central SSO — this app never saw a password, only an authorization code it exchanged for tokens
            server-side.
          </p>
          <a
            href="/logout"
            className="mt-8 rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"
          >
            Log out of Demo App A
          </a>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-md text-sm text-blue-900/70">
            An independent OIDC client application. Signing in redirects through the central SSO; if you&apos;re
            already signed in elsewhere, you won&apos;t be asked for credentials again — that&apos;s the SSO proof
            (section 20 of the implementation plan).
          </p>
          <a
            href="/login"
            className="mt-8 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Log in
          </a>
        </>
      )}
    </div>
  );
}
