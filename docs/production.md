# Production deployment

The security fixes and automated checks are necessary release gates. A passing
local test run does not verify your DNS, certificates, SMTP delivery, backup
storage, capacity, or incident response.

## Getting started on AWS

Use an EC2 Linux instance to run the existing Docker Compose stack for the first
staging deployment. EC2 supplies the server; you manage it from your computer.

1. Create an account through [AWS Free Tier](https://aws.amazon.com/free/), or
   sign in if you already have an AWS account. For an eligible new account,
   select the **Free account plan** during signup and complete verification.
   Existing or previous AWS customers are not eligible for the new-customer
   Free plan and credits; check your actual account benefits before launching.
2. Enable MFA for the root account. Use a separate administrative identity for
   routine infrastructure management; application deployment does not require
   putting root AWS access keys on the server or in this repository.
3. Check the account plan, remaining credits, and expiration in the console's
   Cost and Usage widget. New customers receive $100 in signup credits and can
   earn up to $100 more. The Free account plan ends after six months or when
   credits run out, whichever happens first. Continuing requires a paid plan;
   this is not ongoing free EC2 hosting. See the
   [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/).
4. Select **Asia Pacific (Singapore)** (`ap-southeast-1`) for the initial
   deployment if most users are in Malaysia. Open **EC2** to prepare the server.
   Before launching, check the instance, disk, and public IPv4 cost against your
   credit balance. A **Free tier eligible** label does not guarantee that the
   server will run for the full six months. Eligibility depends on account age
   and plan; see [EC2 Free Tier usage](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html).
5. For the server setup, use Ubuntu 24.04 LTS and budget at least 4 GiB RAM as an
   initial staging estimate for the combined services. Confirm an eligible size
   in the selected region before launching, and measure actual memory and build
   requirements. Restrict SSH (TCP 22) to your own IP; allow public TCP 80/443
   for Caddy. Keep PostgreSQL, Redis, and application ports private.
6. Install Docker Engine and the Compose plugin, then continue with
   **Configuration** below. The HTTPS deployment needs three hostnames under
   one domain and working SMTP. Completing account signup alone does not deploy
   the application.

## Configuration

Use `compose.production.yaml` on a Linux Docker host, separately from the local
`compose.yaml`. The production stack serves only the identity API, SSO UI, and
admin UI. PostgreSQL and authenticated Redis have no published host ports. Caddy
is the only public entry point and obtains/renews HTTPS certificates. The three
hostnames must share a registrable domain for the API's SameSite cookies.

1. Copy `docker/production.env.example` to `docker/production.env` and restrict
   its permissions (`chmod 600 docker/production.env`). It is excluded from Git
   and Docker build contexts. Supply all values; the example has no usable secrets.
2. Generate separate random passwords for PostgreSQL and Redis. URL-encode those
   passwords when constructing `DATABASE_URL` and `REDIS_URL`. Generate separate
   32-byte base64 client-encryption and cookie secrets (`openssl rand -base64 32`).
3. Generate persistent signing keys with
   `pnpm --filter @sso-platform/api generate-jwks` and put the private JSON in
   `OIDC_JWKS`. Store an encrypted copy of the keys with your database backups.
4. Configure authenticated SMTP and send a real verification and password-reset
   email in staging. Do not use test/development mail behavior for release.
5. Point SSO_HOST, ADMIN_HOST, and API_HOST DNS at the server, allow incoming
   TCP 80/443 (and optionally UDP 443), and supply the ACME contact address.

Do not publish the API or database ports, or accept arbitrary forwarded client
addresses. The production API trusts only Caddy's fixed address
`172.30.50.10`. If that subnet conflicts with the host network, change the edge
subnet, Caddy address, and `TRUST_PROXY` together. For another load balancer,
configure its actual trusted address and preserve HTTPS forwarding.

## Release and bootstrap

```sh
docker compose --env-file docker/production.env -f compose.production.yaml build
docker compose --env-file docker/production.env -f compose.production.yaml up -d postgres redis

# Run migrations once per release, before starting the new application version.
docker compose --env-file docker/production.env -f compose.production.yaml run --rm api ./node_modules/.bin/prisma migrate deploy

# Explicit bootstrap: only creates missing roles/clients; existing policy is preserved.
docker compose --env-file docker/production.env -f compose.production.yaml run --rm api ./node_modules/.bin/prisma db seed

docker compose --env-file docker/production.env -f compose.production.yaml up -d
```

For first-time super-admin creation, temporarily supply `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` in the protected production environment file, run the seed
command, then remove them. Seeding an existing email never promotes that account
or resets its password. Normal starts perform neither migrations nor seeding.
The seed no longer overwrites existing role permissions, rotates secrets back to
bootstrap values, or re-enables disabled clients. New permissions for existing
roles require an explicit administrative change.

Migration `20260930090000_harden_sessions_and_email_changes` **revokes existing
portal sessions**. Users must sign in again. It adds a separate hashed session
credential and a pending email address. Do not roll back to an old application
version that accepts public session IDs as bearer credentials. Deploy this
security migration during a controlled cutover, with old API instances stopped.

## Checks before exposing traffic

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm audit --prod`.
- Run `pnpm test:integration` (disposable PostgreSQL/Redis; requires Docker).
- Run `pnpm exec playwright install chromium`, then `pnpm test:browser`.
  This builds the frontends with test URLs and uses ports 3000, 3002, 3003, 4000,
  55434, and 56381. Run integration and browser suites sequentially; their
  disposable containers share the database test ports. Production images must
  be built separately with production URLs, as in the release commands above.
- Check valid HTTPS certificates, Secure/HttpOnly cookies, and real mail delivery.
- Confirm migration success, user login, consent, token exchange, logout, admin
  permissions, and key availability through the public HTTPS entrypoint.
- Load-test with representative concurrency and tune `API_RATE_LIMIT` and
  `OIDC_RATE_LIMIT` (requests per minute per source IP). Limits are atomic and
  shared through Redis, cover protocol endpoints, and fail closed with 503 if
  Redis is unavailable. Account-specific login/reset limits also remain active.

The single-host Compose stack is a deployment baseline, not high availability.
Set capacity and availability targets before choosing replicas or managed
PostgreSQL/Redis. All replicas must use the same signing and encryption keys.

## Backup and recovery

Schedule encrypted off-host PostgreSQL backups and retention; a Docker volume is
not a backup. For example, with the production services running:

```sh
docker compose --env-file docker/production.env -f compose.production.yaml exec -T postgres pg_dump -U sso -d sso -Fc > sso-backup.dump
```

Encrypt the dump before moving it to backup storage. Back up the encryption and
signing keys separately with equivalent access controls. Periodically restore a
dump into an **isolated** database using `pg_restore --no-owner`, apply the
release migrations, and verify user, client, and role records. Record measured
recovery time and the newest recoverable data timestamp. Do not test restoration
against the live database.

Redis AOF persists OIDC state. After a security incident or uncertain recovery,
prefer invalidating sessions/grants and asking users to authenticate again over
restoring potentially revoked credentials. Coordinate recovery across PostgreSQL
and Redis; restoring an old snapshot can otherwise revive revoked state.

Monitor health, request failures/latency, database storage, Redis availability,
rate-limit failures, SMTP failures, certificate renewal, and backup age. Exercise
alerts and the restore procedure in staging before approving a release. HTTP
request logging does not replace an external monitoring and alerting service.

## Optional staging demo apps

Layer `compose.demos.yaml` over the production file to add the two example OIDC
clients. Use the **same Compose project name** as the existing deployment so its
PostgreSQL, Redis, and certificate volumes are reused. The example below uses
`sso-staging`. Both demo hosts must resolve to the server before Caddy can obtain
their certificates. For this staging deployment they are
`app-a.atoz-sso-test.duckdns.org` and `app-b.atoz-sso-test.duckdns.org`.

On the server, from the repository root, generate independent client and cookie
secrets directly in the protected environment file (replace the base domain for
another deployment):

```sh
sudo docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD/docker:/config" \
  -v "$PWD/scripts/prepare-demo-env.cjs:/prepare-demo-env.cjs:ro" \
  node:22-alpine node /prepare-demo-env.cjs atoz-sso-test.duckdns.org

dc() {
  sudo docker compose -p sso-staging \
    --env-file docker/production.env \
    -f compose.production.yaml -f compose.demos.yaml "$@"
}

dc config --quiet &&
dc build demo-app-a &&
dc build demo-app-b &&
dc build sso-web
```

The helper only fills missing demo values; rerunning it preserves the existing
credentials and the rest of the file. Protect and back up the environment file
as before. The apps receive their own client/session secrets, not the complete
API environment file. Public app addresses are provided at build time as well as
runtime. Build sequentially to limit memory use; monitor capacity when running
two additional Next.js servers on a small host.

Register the demo clients using the existing bootstrap-only seed, explicitly
excluding administrator creation, then apply the deployment:

```sh
dc run --rm -e SEED_ADMIN_EMAIL= -e SEED_ADMIN_PASSWORD= \
  api ./node_modules/.bin/prisma db seed
dc up -d --wait
dc ps
```

The seed must report both demo clients. Their callback URLs are the respective
HTTPS app origins plus `/callback`; their registered post-logout URLs are their
HTTPS origins. Existing client registrations are not overwritten by reseeding.
If these settings change after registration, update the existing application
through the admin portal as well. Keep using both Compose files for subsequent
updates; the base deployment alone does not configure the demo routes.

Verify HTTPS for both apps. In one fresh browser profile, open App A, click
**Continue with SSO**, sign in, and approve consent. Open App B in that same
profile and continue with SSO. It may ask for consent to access the second app,
but should not ask for the password again. Confirm both pages show the same
account. Local app logout only ends that app's session. Do not describe it as
immediate logout from all applications.

## Identity behavior

Email edits set `pendingEmail`; login and recovery continue using the current
address. Verification atomically promotes the replacement and invalidates
previous password-reset links. An admin cannot modify an account whose
permissions exceed their own. Session lists contain management IDs only, never
bearer tokens or hashes.

Central logout/revocation removes provider sessions, grants, and tokens. An
independent relying party's local cookie can still exist until its own expiry;
applications requiring immediate local logout need online session validation or
a supported logout notification integration. The demo clients are examples, and
are not deployed by the base production Compose file; the optional staging
override above adds them.
