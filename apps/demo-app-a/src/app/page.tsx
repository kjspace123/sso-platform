import { cookies } from 'next/headers';
import { decodeSession } from '@/lib/session-cookie';

export default async function Home() {
  const session = decodeSession((await cookies()).get('demo_a_session')?.value);

  return (
    <main className="flex min-h-screen flex-1 items-center bg-gradient-to-br from-blue-100 via-blue-50 to-white px-5 py-12 text-blue-950">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-blue-200 bg-white p-8 text-center shadow-xl shadow-blue-950/10 sm:p-12">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-bold text-white shadow-md shadow-blue-700/25">
          A
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
          Independent OIDC client
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-blue-950">Demo App A</h1>

        {session ? (
          <>
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">
              <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
              Signed in
            </div>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-700">
              Signed in as{' '}
              <strong className="font-semibold text-blue-950">
                {session.claims.email ?? session.claims.sub}
              </strong>{' '}
              through the central SSO. This app received an authorization code and never handled
              your password.
            </p>
            <a
              href="/logout"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 bg-white px-5 py-2.5 text-sm font-bold text-blue-900 shadow-sm transition hover:border-blue-400 hover:bg-blue-50"
            >
              Log out of Demo App A
            </a>
          </>
        ) : (
          <>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-700">
              Sign in through the central identity provider. Afterward, Demo App B can reuse the
              same SSO session without asking for your password again.
            </p>
            <a
              href="/login"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800"
            >
              Continue with SSO
            </a>
          </>
        )}
        <p className="mt-8 text-xs font-medium text-slate-600">
          Authorization Code flow · PKCE · OpenID Connect
        </p>
      </section>
    </main>
  );
}
