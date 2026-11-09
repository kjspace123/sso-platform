export interface BuildAuthorizeUrlOptions {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

/** Builds the `/authorize` URL a consumer app redirects the browser to. */
export function buildAuthorizeUrl(opts: BuildAuthorizeUrlOptions): string {
  const url = new URL('/authorize', opts.issuer);
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', opts.scope ?? 'openid email offline_access');
  // oidc-provider only issues a refresh token for offline_access if the
  // client explicitly asks for the consent prompt (mirrors how most real
  // IdPs require access_type=offline + prompt=consent) — refresh token
  // rotation is a platform-wide requirement (section 12), so this is on by
  // default rather than something every consumer app has to remember.
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', opts.state);
  url.searchParams.set('nonce', opts.nonce);
  url.searchParams.set('code_challenge', opts.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export interface BuildEndSessionUrlOptions {
  issuer: string;
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
  state?: string;
}

export function buildEndSessionUrl(opts: BuildEndSessionUrlOptions): string {
  const url = new URL('/session/end', opts.issuer);
  if (opts.idTokenHint) url.searchParams.set('id_token_hint', opts.idTokenHint);
  if (opts.postLogoutRedirectUri) url.searchParams.set('post_logout_redirect_uri', opts.postLogoutRedirectUri);
  if (opts.state) url.searchParams.set('state', opts.state);
  return url.toString();
}
