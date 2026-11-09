import { cookies } from "next/headers";
import { decodeSession } from "@/lib/session-cookie";

export default async function Home() {
  const session = decodeSession((await cookies()).get("demo_b_session")?.value);

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-purple-50 px-4 text-center">
      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-600 text-sm font-semibold text-white">
        B
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-purple-950">Demo App B</h1>

      {session ? (
        <>
          <p className="mt-2 max-w-md text-sm text-purple-900/70">
            Signed in as{" "}
            <span className="font-medium text-purple-950">{session.claims.email ?? session.claims.sub}</span>. If you
            didn&apos;t have to enter credentials to get here after signing in via Demo App A, that&apos;s the SSO
            proof (section 20 of the implementation plan) — this is a completely independent client application that
            just happened to reuse your existing SSO session.
          </p>
          <a
            href="/logout"
            className="mt-8 rounded-md border border-purple-300 bg-white px-4 py-2 text-sm font-semibold text-purple-900 hover:bg-purple-100"
          >
            Log out of Demo App B
          </a>
        </>
      ) : (
        <>
          <p className="mt-2 max-w-md text-sm text-purple-900/70">
            A second, independent OIDC client application. Its job is to prove cross-application SSO: sign in via{" "}
            <a href="http://localhost:3002" className="underline">
              Demo App A
            </a>{" "}
            first, then come back here and log in — you shouldn&apos;t be asked for credentials again (section 11.2).
          </p>
          <a
            href="/login"
            className="mt-8 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            Log in
          </a>
        </>
      )}
    </div>
  );
}
