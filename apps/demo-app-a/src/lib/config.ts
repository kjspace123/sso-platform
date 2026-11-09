function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var ${name} — see .env.example`);
  return value;
}

/** Server-only OIDC client config — never imported from a Client Component. */
export const oidcConfig = {
  issuer: required("OIDC_ISSUER", process.env.OIDC_ISSUER),
  clientId: required("OIDC_CLIENT_ID", process.env.OIDC_CLIENT_ID),
  clientSecret: required("OIDC_CLIENT_SECRET", process.env.OIDC_CLIENT_SECRET),
  appUrl: required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL),
  get redirectUri() {
    return `${this.appUrl}/callback`;
  },
};
