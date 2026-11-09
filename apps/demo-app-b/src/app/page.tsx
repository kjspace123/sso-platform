import { cookies } from 'next/headers';
import { decodeSession } from '@/lib/session-cookie';

export default async function Home() {
  const session = decodeSession((await cookies()).get('demo_b_session')?.value);
  const demoAppAUrl = process.env.DEMO_APP_A_URL ?? 'http://localhost:3002';

  return (
    <main className="flex min-h-screen flex-1 items-center bg-gradient-to-br from-purple-100 via-purple-50 to-white px-5 py-12 text-purple-950">
      <section className="mx-auto w-full max-w-xl rounded-3xl border border-purple-200 bg-white p-8 text-center shadow-xl shadow-purple-950/10 sm:p-12">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-700 text-lg font-bold text-white shadow-md shadow-purple-700/25">
          B
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-700">
          Independent OIDC client
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-purple-950">Demo App B</h1>

        {session ? (
          <>
            <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-900">
              <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
              SSO session reused
            </div>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-700">
              Signed in as{' '}
              <strong className="font-semibold text-purple-950">
                {session.claims.email ?? session.claims.sub}
              </strong>
              . If you already used Demo App A, this independent application recognized your central
              SSO session without asking for credentials again.
            </p>
            <a
              href="/logout"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-purple-300 bg-white px-5 py-2.5 text-sm font-bold text-purple-900 shadow-sm transition hover:border-purple-400 hover:bg-purple-50"
            >
              Log out of Demo App B
            </a>
          </>
        ) : (
          <>
            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-700">
              For the clearest SSO test, sign in to{' '}
              <a
                href={demoAppAUrl}
                className="font-bold text-purple-800 underline decoration-purple-300 underline-offset-4 hover:text-purple-950"
              >
                Demo App A
              </a>{' '}
              first. Then return here and continue—the SSO provider should not request your password
              again.
            </p>
            <a
              href="/login"
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-purple-700/20 transition hover:bg-purple-800"
            >
              Continue with SSO
            </a>
          </>
        )}
        <p className="mt-8 text-xs font-medium text-slate-600">
          Cross-application SSO verification client
        </p>
      </section>
    </main>
  );
}
