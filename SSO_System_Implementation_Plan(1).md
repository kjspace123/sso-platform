# SSO System — Full Implementation Plan

## Document Information

| Item | Details |
|---|---|
| Project | Single Sign-On (SSO) Platform |
| Scope | SSO Frontend, Backend Services, Admin Portal, Demo Consumer Applications |
| Target Delivery | August 31, 2026 |
| Primary Goal | Deliver a production-style SSO MVP demonstrating full-stack capability |
| Main Language | TypeScript |
| Architecture Style | Monorepo, modular backend, centralized identity provider |
| Authentication Standard | OAuth 2.0 + OpenID Connect |
| Primary SSO Flow | Authorization Code Flow with PKCE |

---

# 1. Project Overview

The goal is to build a complete **Single Sign-On platform** that acts as a centralized identity provider for multiple applications.

The solution includes:

- Central SSO login application
- Authentication and authorization backend
- OAuth 2.0 / OpenID Connect identity provider
- User and session management
- Admin portal
- Role-based access control
- Application/client management
- Audit logs
- Two demo applications proving cross-application SSO
- Automated tests
- Docker-based local/deployment setup
- Documentation and final demo flow

The first release should prioritize a **working, secure, end-to-end SSO system** over excessive UI polish or enterprise-only features.

---

# 2. Project Objectives

## 2.1 User Objectives

Users should be able to:

- Register an account
- Verify their email address
- Log in through the centralized SSO
- Access multiple applications without logging in again
- Log out
- Log out from all devices
- Reset forgotten passwords
- Update passwords
- View active sessions
- View connected applications
- Manage their profile

## 2.2 Admin Objectives

Administrators should be able to:

- View system activity
- Search and manage users
- Enable or disable user accounts
- Assign roles
- Manage permissions
- Register SSO client applications
- Configure redirect URIs
- Rotate client secrets
- View active sessions
- Revoke sessions
- Review audit logs
- Disable applications

## 2.3 Engineering Objectives

The project should demonstrate:

- Frontend application development
- Backend API architecture
- Database design
- Authentication and authorization design
- OAuth 2.0 / OpenID Connect concepts
- Session and token lifecycle management
- RBAC implementation
- Security hardening
- API documentation
- Automated testing
- Containerized development
- CI/CD fundamentals

---

# 3. Scope

## 3.1 MVP Scope

The MVP includes:

### Authentication

- Registration
- Email verification and resend
- Login
- Logout
- Forgot password
- Reset password
- Change password
- Access token issuance
- Refresh token rotation
- SSO browser session
- Session revocation
- Logout all devices

### OAuth / OIDC

- Authorization endpoint
- Token endpoint
- Authorization Code Flow
- PKCE
- State validation
- Nonce validation
- ID token issuance
- Access token issuance
- Refresh token issuance
- Redirect URI validation
- Client registration
- Client secret rotation
- Discovery metadata
- JWKS support

### User Portal

- Profile
- Security settings
- Password management
- Active sessions
- Connected applications

### Admin Portal

- Dashboard
- User management
- Application management
- Roles
- Permissions
- Sessions
- Audit logs

### Demo Applications

- Demo App A
- Demo App B

The two demo applications are required to prove that SSO works correctly across independent clients.

---

## 3.2 Out of Scope for Initial Delivery

The following features should be treated as post-MVP unless core delivery finishes early:

- Enterprise SAML
- SCIM provisioning
- Social login
- Passwordless login
- WebAuthn / Passkeys
- MFA / TOTP
- LDAP / Active Directory integration
- Multi-tenancy
- Organization management
- Fine-grained policy engine
- Device trust
- Risk-based authentication

---

# 4. High-Level Architecture

```text
                       ┌──────────────────────┐
                       │      Demo App A      │
                       └──────────┬───────────┘
                                  │
                                  │ OIDC Login
                                  ▼
┌───────────────────────────────────────────────────────────┐
│                    SSO Platform                           │
│                                                           │
│  ┌──────────────────────┐                                 │
│  │      SSO Web         │                                 │
│  │                      │                                 │
│  │ Login                │                                 │
│  │ Registration         │                                 │
│  │ Consent              │                                 │
│  │ Profile              │                                 │
│  │ Sessions             │                                 │
│  └──────────┬───────────┘                                 │
│             │                                             │
│             ▼                                             │
│  ┌──────────────────────┐      ┌──────────────────────┐   │
│  │   NestJS Backend     │◀────▶│   OIDC Provider      │   │
│  │                      │      │                      │   │
│  │ Users                │      │ /authorize           │   │
│  │ Passwords            │      │ /token               │   │
│  │ Applications         │      │ Discovery            │   │
│  │ Roles                │      │ JWKS                 │   │
│  │ Permissions          │      │ PKCE                 │   │
│  │ Sessions             │      │ Tokens               │   │
│  │ Audit                │      └──────────────────────┘   │
│  └──────────┬───────────┘                                 │
│             │                                             │
│     ┌───────┴───────────────┐                             │
│     │                       │                             │
│     ▼                       ▼                             │
│ ┌─────────────┐       ┌─────────────┐                     │
│ │ PostgreSQL  │       │    Redis    │                     │
│ └─────────────┘       └─────────────┘                     │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  Admin Portal                       │  │
│  │ Users / Apps / Roles / Sessions / Audit / Security │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                                  ▲
                                  │
                                  │ OIDC Login
                       ┌──────────┴───────────┐
                       │      Demo App B      │
                       └──────────────────────┘
```

---

# 5. Technology Stack

## 5.1 Core Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Package Manager | pnpm |
| Monorepo | pnpm workspace |
| SSO Frontend | Next.js |
| Admin Portal | Next.js |
| Demo Applications | Next.js |
| UI Framework | React |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Form Handling | React Hook Form |
| Frontend Validation | Zod |
| Server State | TanStack Query |
| Backend | NestJS |
| OIDC Provider | panva `oidc-provider` |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache / Temporary Auth State | Redis |
| Password Hashing | Argon2id |
| API Docs | Swagger / OpenAPI |
| Backend Validation | Zod and/or class-validator |
| Unit Testing | Vitest or Jest |
| E2E Testing | Playwright |
| Containerization | Docker |
| Local Orchestration | Docker Compose |
| Reverse Proxy | Nginx |
| CI/CD | GitHub Actions |

---

# 6. Technology Decisions

## 6.1 TypeScript

TypeScript should be used across the entire project.

Benefits:

- Shared models between frontend and backend
- Strong typing
- Better refactoring support
- Easier API contract maintenance
- Reduced context switching

---

## 6.2 Next.js

Use Next.js for:

- SSO web application
- Admin portal
- Demo App A
- Demo App B

Reasons:

- Mature React framework
- Strong routing
- Server/client rendering support
- Good TypeScript support
- Easy deployment
- Shared development patterns across all frontend applications

---

## 6.3 NestJS

Use NestJS for backend services.

Reasons:

- Modular architecture
- Dependency injection
- Guards and decorators are useful for authorization
- Strong TypeScript support
- Suitable for large domain-based backend structure
- Swagger/OpenAPI integration
- Good testability

---

## 6.4 `oidc-provider`

Use `oidc-provider` to implement OAuth 2.0 and OpenID Connect protocol behavior.

The project should **not implement OAuth/OIDC protocol internals from scratch**.

`oidc-provider` should handle protocol-sensitive responsibilities such as:

- Authorization endpoint
- Token endpoint
- Authorization Code Flow
- PKCE
- OpenID Connect discovery
- JWKS
- ID token generation
- Standard OAuth/OIDC validation behavior

The custom backend should still implement:

- User management
- Password authentication
- Roles
- Permissions
- Sessions
- Application registration
- Business rules
- Audit logging
- Account status
- Security policies
- Admin APIs

---

## 6.5 PostgreSQL

PostgreSQL should be the primary source of truth.

It is suitable because the data model is relational:

```text
User
 ├── Sessions
 ├── Roles
 ├── Audit Logs
 └── Connected Applications

Role
 └── Permissions

Application
 ├── Redirect URIs
 ├── Client Secrets
 └── OAuth Configuration
```

---

## 6.6 Prisma

Prisma should be used as the ORM.

Benefits:

- Type-safe queries
- Database migrations
- Good TypeScript integration
- Faster development
- Clear schema definition

---

## 6.7 Redis

Redis should be used only for temporary or high-speed state.

Recommended uses:

- Rate limiting
- Login attempt counters
- Temporary authorization state
- Short-lived OAuth state
- Session cache
- Temporary security data

PostgreSQL remains the authoritative data store.

---

## 6.8 Argon2id

Passwords should be hashed using Argon2id.

Never store:

```text
password
raw password
plain client secret
raw refresh token
```

Persist only secure hashes where applicable.

---

# 7. Frontend Technology Structure

## 7.1 SSO Frontend

Recommended routes:

```text
/login
/register
/forgot-password
/reset-password
/consent
/profile
/profile/security
/profile/sessions
/profile/applications
/error
```

Recommended frontend stack:

```text
Next.js
React
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod
TanStack Query
```

---

## 7.2 Admin Portal

Recommended routes:

```text
/dashboard
/users
/users/[id]
/applications
/applications/[id]
/roles
/roles/[id]
/permissions
/sessions
/audit-logs
/security
```

Admin UI should focus on operational usability rather than decorative dashboards.

---

# 8. Backend Architecture

Use domain-driven module boundaries rather than grouping all controllers and services together.

```text
apps/api/src/

auth/
users/
applications/
roles/
permissions/
sessions/
audit/
password-reset/
admin/
security/

common/
  decorators/
  guards/
  filters/
  interceptors/
  middleware/
  validation/

database/
config/
```

---

# 9. Monorepo Structure

```text
sso-platform/

apps/
  sso-web/
  admin-web/
  demo-app-a/
  demo-app-b/
  api/
  identity-provider/

packages/
  ui/
  types/
  validation/
  auth-client/
  config/
  eslint-config/
  tsconfig/

prisma/
  schema.prisma/
  migrations/

docker/
  nginx/

docs/
  architecture/
  api/
  security/
  demo/

compose.yaml
pnpm-workspace.yaml
package.json
README.md
```

---

# 10. Database Design

## 10.1 User

```text
id
email
passwordHash
status
emailVerified
createdAt
updatedAt
lastLoginAt
```

---

## 10.2 Role

```text
id
name
description
createdAt
updatedAt
```

---

## 10.3 Permission

```text
id
name
description
```

Example permission names:

```text
user:read
user:create
user:update
user:disable

application:read
application:create
application:update
application:disable

session:read
session:revoke

role:read
role:update

audit:read
```

---

## 10.4 UserRole

```text
userId
roleId
```

---

## 10.5 RolePermission

```text
roleId
permissionId
```

---

## 10.6 Application

```text
id
name
clientId
status
type
createdAt
updatedAt
```

---

## 10.7 ApplicationRedirectUri

```text
id
applicationId
redirectUri
```

---

## 10.8 ClientSecret

```text
id
applicationId
secretHash
createdAt
expiresAt
revokedAt
```

---

## 10.9 Session

```text
id
userId
ipAddress
userAgent
deviceName
createdAt
lastSeenAt
expiresAt
revokedAt
```

---

## 10.10 RefreshToken

```text
id
sessionId
tokenHash
familyId
createdAt
expiresAt
usedAt
revokedAt
```

---

## 10.11 PasswordResetToken

```text
id
userId
tokenHash
createdAt
expiresAt
usedAt
```

---

## 10.12 AuditLog

```text
id
actorId
action
resourceType
resourceId
ipAddress
metadata
createdAt
```

---

# 11. Authentication Flow

## 11.1 Login Flow

```text
User
 ↓
Consumer Application
 ↓
Redirect to /authorize
 ↓
SSO Provider checks session
 ↓
No active SSO session
 ↓
Display SSO Login
 ↓
User submits credentials
 ↓
NestJS Auth Service validates credentials
 ↓
Create SSO Session
 ↓
Authorization Code generated
 ↓
Redirect back to Consumer Application
 ↓
Application exchanges code at /token
 ↓
Access Token + ID Token + Refresh Token
 ↓
Authenticated Application
```

---

## 11.2 Existing SSO Session

```text
User already logged into App A
 ↓
User opens App B
 ↓
App B redirects to SSO
 ↓
SSO session already exists
 ↓
No credentials required
 ↓
Authorization Code generated
 ↓
Redirect to App B
 ↓
App B exchanges code
 ↓
User authenticated
```

This flow is the core proof that Single Sign-On works.

---

# 12. Token Strategy

Recommended initial defaults:

| Token | Lifetime | Notes |
|---|---|---|
| Authorization Code | 1–5 minutes | Single use |
| Access Token | 10–15 minutes | Short-lived |
| ID Token | Similar to access token | Identity claims |
| Refresh Token | Days/weeks | Rotated on use |
| Password Reset Token | 15–30 minutes | Single use |

Refresh tokens should use rotation.

Recommended protection:

- Store only refresh token hashes
- Detect token reuse
- Revoke the token family when reuse is detected
- Bind refresh tokens to a session

---

# 13. Browser Session Strategy

The centralized SSO browser session should use a secure cookie.

Recommended settings:

```text
HttpOnly
Secure
SameSite configured appropriately
Short/controlled expiration
```

Avoid storing long-lived authentication tokens directly in:

```text
localStorage
```

where safer cookie/server-side alternatives are available.

---

# 14. Authorization Strategy

Use permission-based RBAC.

Example:

```text
Super Admin
 ├── user:create
 ├── user:update
 ├── user:disable
 ├── application:create
 ├── application:update
 ├── role:update
 └── audit:read

Admin
 ├── user:read
 ├── user:update
 ├── application:read
 └── session:revoke

User
 └── profile:update
```

NestJS endpoint example:

```typescript
@RequirePermission('user:update')
```

Avoid hardcoding authorization logic such as:

```typescript
if (user.role === 'admin') {
  // ...
}
```

whenever permission-based checks provide a cleaner model.

---

# 15. Application / OAuth Client Management

Admin users should be able to register client applications.

Application fields:

```text
Application Name
Client ID
Client Type
Client Secret
Redirect URIs
Post Logout Redirect URIs
Status
Created At
Updated At
```

Capabilities:

- Create client
- Edit client
- Rotate client secret
- Disable client
- Validate redirect URIs
- View client configuration

Client secrets should never be stored in plain text.

---

# 16. Security Requirements

The following are core requirements:

- HTTPS
- Argon2id password hashing
- Secure cookies
- HttpOnly cookies
- Appropriate SameSite settings
- Authorization Code Flow
- PKCE
- State validation
- Nonce validation
- Redirect URI validation
- Short-lived access tokens
- Refresh token rotation
- Refresh token reuse detection
- CSRF protection
- CORS allowlist
- Login rate limiting
- Password attempt throttling
- Input validation
- Security headers
- Session revocation
- Account disable checks
- Application disable checks
- Audit logging
- Sensitive value redaction in logs
- Client secret hashing
- Password reset token hashing
- Email verification token hashing, expiry, and single-use enforcement

---

# 17. API Categories

## Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/email-verification/verify
POST /auth/email-verification/resend
POST /auth/logout
POST /auth/logout-all
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/change-password
```

## User

```text
GET    /users/me
PATCH  /users/me
GET    /users/me/sessions
DELETE /users/me/sessions/:id
```

## Admin Users

```text
GET   /admin/users
GET   /admin/users/:id
PATCH /admin/users/:id
POST  /admin/users/:id/disable
POST  /admin/users/:id/enable
POST  /admin/users/:id/revoke-sessions
```

## Applications

```text
GET    /admin/applications
POST   /admin/applications
GET    /admin/applications/:id
PATCH  /admin/applications/:id
POST   /admin/applications/:id/rotate-secret
POST   /admin/applications/:id/disable
```

## Roles

```text
GET   /admin/roles
POST  /admin/roles
PATCH /admin/roles/:id
```

## Audit

```text
GET /admin/audit-logs
```

Protocol endpoints such as `/authorize`, `/token`, discovery, and JWKS should be handled by the OIDC provider layer.

---

# 18. Audit Logging

Important events to record:

```text
USER_REGISTERED
EMAIL_VERIFICATION_REQUESTED
EMAIL_VERIFIED
USER_LOGIN
USER_LOGIN_FAILED
USER_LOGOUT
USER_LOGOUT_ALL
PASSWORD_CHANGED
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_COMPLETED
SESSION_REVOKED
USER_DISABLED
USER_ENABLED
APPLICATION_CREATED
APPLICATION_UPDATED
APPLICATION_DISABLED
CLIENT_SECRET_ROTATED
ROLE_ASSIGNED
ROLE_REMOVED
PERMISSION_UPDATED
```

Audit logs should capture appropriate metadata without storing sensitive credentials or tokens.

---

# 19. Development Phases

## Phase 1 — Requirements and Architecture

### Goals

- Confirm MVP scope
- Confirm security requirements
- Define application boundaries
- Define authentication flows
- Define database model
- Define repository structure
- Define development standards

### Deliverables

- Architecture diagram
- Tech stack decision
- Database ER design
- API outline
- Security checklist
- Project plan

---

## Phase 2 — Project Setup

### Goals

- Create monorepo
- Configure pnpm workspace
- Create Next.js projects
- Create NestJS backend
- Configure PostgreSQL
- Configure Redis
- Configure Prisma
- Configure Docker Compose
- Configure shared packages
- Configure linting and formatting

### Deliverables

- Running local environment
- Connected database
- Redis connection
- Initial migrations
- CI skeleton

---

## Phase 3 — Core User Authentication

### Goals

- Registration
- Password hashing
- Login
- Logout
- Session creation
- Account status checks
- Password reset
- Change password

### Deliverables

- Working authentication API
- SSO browser session
- Password reset flow
- Basic security controls

---

## Phase 4 — OIDC / OAuth Integration

### Goals

- Integrate `oidc-provider`
- Register clients
- Implement account resolution
- Implement Authorization Code Flow
- Enable PKCE
- Validate redirect URIs
- Issue ID/access/refresh tokens
- Configure discovery
- Configure JWKS

### Deliverables

- Working `/authorize`
- Working `/token`
- Discovery endpoint
- JWKS endpoint
- Client configuration

---

## Phase 5 — SSO Frontend

### Goals

- Login
- Register
- Forgot password
- Reset password
- Consent
- Error handling
- Profile
- Sessions

### Deliverables

- Complete user authentication UI
- Correct return-to-client behavior
- Session management UI

---

## Phase 6 — Demo App A

### Goals

- Register App A as an OIDC client
- Implement login
- Handle callback
- Display authenticated user
- Implement logout

### Deliverables

- First external consumer app successfully authenticates via SSO

---

## Phase 7 — Demo App B

### Goals

- Register App B
- Implement authentication
- Validate existing SSO session reuse

### Deliverables

- Cross-application SSO proof

---

## Phase 8 — Admin Portal

### Goals

- Dashboard
- User management
- Application management
- Session management
- Roles
- Permissions
- Audit logs

### Deliverables

- Operational admin portal

---

## Phase 9 — Security Hardening

### Goals

- Rate limiting
- Login throttling
- CSRF protection
- Secure cookies
- Security headers
- Input validation
- Secret handling review
- Refresh token reuse detection
- Audit review

### Deliverables

- Completed security checklist
- Security-focused tests

---

## Phase 10 — Testing

### Unit Tests

Focus on:

- Password validation
- Role checks
- Permission checks
- Session logic
- Token rotation logic
- Application validation

### Integration Tests

Focus on:

- Database operations
- Login flow
- Password reset
- Admin APIs
- Session revocation

### E2E Tests

Use Playwright for:

- Login
- Logout
- Password reset
- SSO between App A and App B
- Disabled account
- Revoked session
- Invalid OAuth request

---

# 20. Critical E2E Test

```text
Scenario: User can SSO between App A and App B

1. Open App A
2. Click Login
3. Redirect to SSO
4. Enter credentials
5. Redirect back to App A
6. Confirm authenticated user
7. Open App B
8. App B redirects to SSO
9. Existing SSO session is detected
10. No login form is shown
11. Redirect back to App B
12. Confirm authenticated user
```

---

# 21. Security Test Cases

Test:

```text
Expired authorization code
Reused authorization code
Invalid redirect URI
Incorrect PKCE verifier
Missing state
Invalid nonce
Expired access token
Expired refresh token
Refresh token reuse
Disabled user
Disabled application
Revoked session
Insufficient permission
Login rate limit
Password reset token reuse
```

---

# 22. Docker Setup

Local development should run:

```text
PostgreSQL
Redis
API
Identity Provider
SSO Web
Admin Web
Demo App A
Demo App B
Nginx
```

The goal:

```bash
docker compose up
```

should start the complete platform or, at minimum, all required infrastructure and services with documented development commands.

---

# 23. CI/CD Plan

GitHub Actions should run:

```text
Install dependencies
Lint
Type check
Unit tests
Integration tests
Build applications
E2E tests where feasible
Docker image build
```

Deployment can initially remain simple as long as it is documented and reproducible.

---

# 24. Environment Configuration

Example configuration categories:

```text
DATABASE_URL
REDIS_URL

APP_BASE_URL
SSO_BASE_URL
ADMIN_BASE_URL

OIDC_ISSUER
OIDC_SIGNING_KEY
COOKIE_SECRET

ACCESS_TOKEN_TTL
REFRESH_TOKEN_TTL

SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
SMTP_SECURE

LOG_LEVEL
```

Secrets must not be committed to source control.

Provide:

```text
.env.example
```

with safe placeholders.

---

# 25. Logging and Observability

Initial logging should cover:

- Authentication failures
- OAuth failures
- Session errors
- Database failures
- Authorization failures
- Admin actions

Logs must redact:

- Passwords
- Tokens
- Client secrets
- Reset tokens
- Cookie values

Optional later improvements:

- Structured JSON logs
- Metrics
- Error tracking
- Tracing

---

# 26. Delivery Timeline

| Date | Focus | Expected Result |
|---|---|---|
| Aug 11 | Architecture and project setup | Architecture, repo, DB, Docker |
| Aug 12 | Database and user module | Core schema and migrations |
| Aug 13 | Authentication API | Register, login, logout |
| Aug 14 | Sessions and password flows | Session lifecycle and reset |
| Aug 17 | OIDC provider integration | Authorization flow foundation |
| Aug 18 | Token flow and PKCE | Code exchange working |
| Aug 19 | SSO frontend | Login and redirect experience |
| Aug 20 | Demo App A | First client integrated |
| Aug 21 | Demo App B | Cross-app SSO working |
| Aug 24 | Admin portal | Dashboard and users |
| Aug 25 | Application management | OAuth client administration |
| Aug 26 | Roles and permissions | RBAC |
| Aug 27 | Sessions and audit | Security administration |
| Aug 28 | Security and testing | E2E and hardening |
| Aug 31 | Deployment and documentation | Final demo-ready release |

---

# 27. Critical Milestones

## Milestone 1 — Core Authentication Works

Must support:

- Register
- Login
- Logout
- Session
- Password hashing

## Milestone 2 — OIDC Client Authentication Works

App A can authenticate using the SSO provider.

## Milestone 3 — Actual SSO Works

App A login allows App B access without another credential prompt.

**Target: August 21, 2026**

## Milestone 4 — Administration Works

Admins can manage:

- Users
- Applications
- Roles
- Sessions

## Milestone 5 — Final Release

- Tests pass
- Documentation complete
- Docker setup works
- Demo flow is reliable

---

# 28. Priority Order

If schedule pressure occurs, prioritize:

1. Backend authentication
2. OIDC provider integration
3. Authorization Code + PKCE flow
4. SSO frontend
5. Demo App A
6. Demo App B
7. Session lifecycle
8. Admin user management
9. Application management
10. RBAC
11. Audit logs
12. Security hardening
13. UI polish
14. Optional enhancements

Do not prioritize dashboard polish over core SSO functionality.

---

# 29. Technologies Not Recommended for This Project

For this specific project, avoid using a fully managed authentication product as the main implementation, such as:

```text
Auth0
Clerk
Firebase Authentication
Supabase Auth
AWS Cognito
```

These are valid production solutions, but they would remove much of the backend identity work this project is intended to demonstrate.

The recommended approach is:

```text
Use mature OAuth/OIDC protocol libraries
+
Build the surrounding identity platform yourself
```

This avoids unsafe protocol reimplementation while still demonstrating full-stack engineering capability.

---

# 30. Risks and Mitigation

## Risk: OAuth/OIDC Complexity

Mitigation:

- Use `oidc-provider`
- Do not implement protocol cryptography manually
- Test against two consumer applications

## Risk: Schedule Too Tight

Mitigation:

- Complete cross-app SSO first
- Keep admin portal MVP-focused
- Defer MFA and enterprise features

## Risk: Session / Token Bugs

Mitigation:

- Short-lived access tokens
- Refresh token rotation
- Automated integration tests
- Session revocation tests

## Risk: Security Issues

Mitigation:

- Use established libraries
- Hash all sensitive persisted tokens
- Add rate limits
- Validate redirect URIs
- Add dedicated security test cases

## Risk: Too Much Frontend Polish

Mitigation:

- Use shadcn/ui and Tailwind
- Prioritize functional flows over custom visual design

---

# 31. Final Demo Scenario

```text
Admin logs into Admin Portal
        ↓
Admin creates Application A
        ↓
Admin creates Application B
        ↓
Admin creates or manages a user
        ↓
User opens Application A
        ↓
Application A redirects to SSO
        ↓
User logs in
        ↓
SSO authenticates the user
        ↓
Application A receives authentication
        ↓
User opens Application B
        ↓
Application B redirects to SSO
        ↓
Existing SSO session is recognized
        ↓
No second login is required
        ↓
User enters Application B
        ↓
Admin views active user sessions
        ↓
Admin revokes the session
        ↓
Applications require authentication again
```

---

# 32. Definition of Done

The project is complete when:

- Users can register and authenticate.
- Passwords are securely hashed.
- Central SSO sessions work.
- OAuth 2.0 / OpenID Connect flow works.
- Authorization Code Flow with PKCE works.
- App A can authenticate through SSO.
- App B can authenticate through SSO.
- App B does not require credentials when an active SSO session exists.
- Access tokens and ID tokens are validated correctly.
- Refresh tokens rotate correctly.
- Sessions can be revoked.
- Users can log out from all devices.
- Admins can manage users.
- Admins can manage OAuth client applications.
- RBAC protects admin functionality.
- Important actions are captured in audit logs.
- Core authentication flows have automated tests.
- Security test cases pass.
- The full stack runs through documented setup instructions.
- Final demo flow works reliably.

---

# 33. Success Criteria

The SSO platform is successful when:

> Two independent applications can authenticate through the centralized SSO service, reuse the same authenticated SSO session, receive and validate tokens correctly, support secure logout and session revocation, and allow administrators to manage users, applications, roles, permissions, and security activity through an admin portal.

---

# 34. Recommended Final Stack Summary

```text
Frontend
├── Next.js
├── React
├── TypeScript
├── Tailwind CSS
├── shadcn/ui
├── React Hook Form
├── Zod
└── TanStack Query

Backend
├── NestJS
├── TypeScript
├── Prisma
├── Argon2id
└── Swagger / OpenAPI

Identity
├── OAuth 2.0
├── OpenID Connect
├── oidc-provider
└── Authorization Code Flow + PKCE

Data
├── PostgreSQL
└── Redis

Testing
├── Vitest / Jest
└── Playwright

Infrastructure
├── Docker
├── Docker Compose
├── Nginx
└── GitHub Actions

Repository
└── pnpm workspace monorepo
```

This stack provides enough backend depth to demonstrate full-stack engineering ability while relying on mature libraries for sensitive OAuth/OpenID Connect protocol behavior.
