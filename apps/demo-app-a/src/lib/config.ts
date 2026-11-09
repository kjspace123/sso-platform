function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var ${name} — see .env.example`);
  return value;
}

/** Server-only OIDC client config — never imported from a Client Component. */
export const oidcConfig = {
  get issuer() {
    return required("OIDC_ISSUER", process.env.OIDC_ISSUER);
  },
  get internalUrl() {
    return process.env.OIDC_INTERNAL_URL || this.issuer;
  },
  get clientId() {
    return required("OIDC_CLIENT_ID", process.env.OIDC_CLIENT_ID);
  },
  get clientSecret() {
    return required("OIDC_CLIENT_SECRET", process.env.OIDC_CLIENT_SECRET);
  },
  get appUrl() {
    return required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);
  },
  get secureCookies() {
    const configured = process.env.COOKIE_SECURE;
    if (configured === undefined) return process.env.NODE_ENV === "production";
    if (configured === "true") return true;
    if (configured === "false") return false;
    throw new Error("COOKIE_SECURE must be true or false");
  },
  get redirectUri() {
    return `${this.appUrl}/callback`;
  },
};
