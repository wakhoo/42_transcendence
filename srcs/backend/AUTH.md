# AUTH.md — Authentication

This document covers the authentication implementation: email/password registration and login, session management with refresh tokens, JWT guard, Google OAuth, and two-factor authentication (TOTP).

---

## Overview

The authentication system is split across two NestJS modules:

| Module | Responsibility |
|---|---|
| `UserModule` | Database access — stores and retrieves users |
| `AuthModule` | Business logic — hashing, verification, JWT issuance, session management, OAuth |

On successful register, login, or OAuth login, the API returns two tokens:
- **`accessToken`** — short-lived JWT (15 minutes), used in the `Authorization` header for protected routes
- **`refreshToken`** — long-lived opaque token (7 days), stored hashed in the `sessions` table, used to get a new access token without re-entering credentials

---

## File Structure

```
src/
├── types/
│   └── express.d.ts              # Extends Express Request with user: JwtPayload
├── user/
│   ├── user.entity.ts            # TypeORM entity → maps to the `users` table
│   ├── user.service.ts           # DB queries: create, findByEmail, findByUsername, findById, findByOAuthId, createOAuthUser
│   └── user.module.ts            # Registers the repository, exports UserService
└── auth/
    ├── dto/
    │   ├── register.dto.ts       # Input validation for /register
    │   ├── login.dto.ts          # Input validation for /login
    │   ├── refresh.dto.ts        # Input validation for /refresh and /logout
    │   └── totp.dto.ts           # Input validation for /2fa/* endpoints (6-digit code)
    ├── guards/
    │   ├── jwt.guard.ts          # Validates full Bearer token on protected routes
    │   └── pending2fa.guard.ts   # Validates partial token (pending2fa: true) on /2fa/verify
    ├── strategies/
    │   └── google.strategy.ts    # Passport Google OAuth 2.0 strategy
    ├── session.entity.ts         # TypeORM entity → maps to the `sessions` table
    ├── session.service.ts        # Session DB operations: create, findValid, delete
    ├── auth.service.ts           # Register, login, refresh, logout, googleLogin, 2FA logic
    ├── auth.controller.ts        # HTTP routes for all auth endpoints
    └── auth.module.ts            # Wires JwtModule, PassportModule, TypeORM, strategies, guards
```

---

## Database

### `users` table

Managed by TypeORM via `user.entity.ts`. The `synchronize: true` option in `app.module.ts` creates or updates the table automatically on startup (development only — set to `false` in production).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | |
| `username` | VARCHAR(20) | NOT NULL, UNIQUE | Auto-generated for OAuth users |
| `password_hash` | VARCHAR(60) | DEFAULT NULL | `NULL` for OAuth-only accounts |
| `avatar_url` | VARCHAR(500) | DEFAULT NULL | Set from Google profile photo |
| `oauth_provider` | VARCHAR(20) | DEFAULT NULL | e.g. `"google"` |
| `oauth_id` | VARCHAR(255) | DEFAULT NULL | Google's unique user ID |
| `totp_secret` | VARCHAR(255) | DEFAULT NULL | TOTP secret key (base32). `NULL` until 2FA setup |
| `totp_enabled` | BOOLEAN | DEFAULT FALSE | Whether 2FA is active for this account |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Set by TypeORM `@CreateDateColumn` |

`password_hash` is exactly 60 characters — the fixed output length of bcrypt with the `$2b$` prefix.

### `sessions` table

Stores active refresh tokens. One user can have multiple concurrent sessions (multiple devices).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | |
| `user_id` | INT | FK → users.id, CASCADE DELETE | |
| `token_hash` | VARCHAR(255) | NOT NULL | SHA-256 hash of the refresh token |
| `expires_at` | TIMESTAMP | NOT NULL | 7 days from creation |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

The raw refresh token is never stored — only its SHA-256 hash. This means a DB breach does not expose usable tokens.

---

## Password Policy

| Rule | Value | Standard |
|---|---|---|
| Minimum length | 8 characters | NIST SP 800-63B + OWASP |
| Maximum length | 128 characters | OWASP |
| Complexity | Not enforced | NIST SP 800-63B |
| Algorithm | bcrypt | OWASP Password Storage Cheat Sheet |
| Cost factor | 12 | OWASP recommendation |

Enforced in two places:
- **DTO layer** (`register.dto.ts`) — rejects the request with `400` before it reaches the service
- **Hashing** (`auth.service.ts`) — `bcrypt.hash(password, 12)`

---

## Token Strategy

### Access Token
- Format: signed JWT (`HS256`)
- Lifetime: configurable via `JWT_EXPIRES_IN` (seconds, default 900)
- Payload: `{ sub: userId, email, iat, exp }`
- Usage: `Authorization: Bearer <accessToken>`
- Stateless — verified by signature alone, no DB lookup

### Partial Token (2FA pending)
- Format: signed JWT (`HS256`), same secret as access token
- Lifetime: 5 minutes (fixed)
- Payload: `{ sub: userId, email, pending2fa: true, iat, exp }`
- Usage: `Authorization: Bearer <partialToken>` on `POST /auth/2fa/verify` only
- `JwtGuard` rejects this token — cannot be used on any other protected route
- `Pending2faGuard` accepts only this token type

### Refresh Token
- Format: 32 random bytes as hex string (64 chars)
- Lifetime: 7 days
- Storage: SHA-256 hash stored in `sessions` table
- Usage: sent in request body to `POST /auth/refresh`
- **Rotation**: every call to `/refresh` invalidates the old token and issues a new pair. Reusing a spent refresh token returns `401`.

---

## Implementation Details

### Registration flow

```
POST /api/auth/register
  │
  ├─ ValidationPipe checks DTO
  │     email     → valid email format
  │     username  → non-empty, max 20 chars
  │     password  → 8–128 chars
  │     → invalid: 400 Bad Request
  │
  ├─ UserService.findByEmail()
  │     → duplicate: 409 "Email already in use"
  │
  ├─ UserService.findByUsername()
  │     → duplicate: 409 "Username already in use"
  │
  ├─ bcrypt.hash(password, 12)
  │
  ├─ UserService.create(email, username, hash)
  │
  └─ issueTokens(userId, email)
        ├─ JwtService.sign({ sub, email }) → accessToken
        └─ SessionService.create(userId)   → refreshToken (stored as SHA-256 hash)
        → 201 { accessToken, refreshToken }
```

### Login flow

```
POST /api/auth/login
  │
  ├─ ValidationPipe checks DTO
  │
  ├─ UserService.findByEmail()
  │     → not found: 401 "Invalid credentials"
  │
  ├─ user.passwordHash === null?
  │     → OAuth-only account: 401 "Invalid credentials"
  │
  ├─ bcrypt.compare(password, passwordHash)
  │     → mismatch: 401 "Invalid credentials"
  │
  ├─ user.totpEnabled?
  │     → YES: JwtService.sign({ sub, email, pending2fa: true }, { expiresIn: 300 })
  │           → 201 { twoFactorRequired: true, partialToken }
  │
  └─ NO: issueTokens(userId, email)
        → 201 { accessToken, refreshToken }
```

> "User not found" and "wrong password" both return the same `401 "Invalid credentials"` — this prevents attackers from discovering whether an email is registered.

### Google OAuth flow

```
GET /api/auth/google
  │
  └─ Passport redirects browser to Google consent screen
        (clientID, scope: email + profile, callbackURL from NEXTAUTH_URL)

      [User approves on Google]

GET /api/auth/callback/google  ← Google redirects here with auth code
  │
  └─ Passport exchanges code for Google profile (id, email, displayName, photo)
        │
        ├─ GoogleStrategy.validate() → returns GoogleProfile object
        │
        └─ AuthService.googleLogin(profile)
              │
              ├─ UserService.findByOAuthId('google', oauthId)
              │     → found: skip to issueTokens
              │
              ├─ UserService.findByEmail(profile.email)
              │     → found (email/password account): 409 Conflict
              │
              ├─ generateUsername(email)
              │     → email prefix, stripped of special chars, max 18 chars
              │     → appends _1, _2... if username is taken
              │
              ├─ UserService.createOAuthUser(provider, oauthId, email, username, avatarUrl)
              │
              ├─ user.totpEnabled?
              │     → YES: sign partial token
              │           → 302 redirect to ${NEXTAUTH_URL}/auth/2fa?partialToken=...
              │
              └─ NO: issueTokens(userId, email)
                    → 302 redirect to ${NEXTAUTH_URL}/auth/callback?accessToken=...&refreshToken=...
```

**Frontend responsibility:**
- `/auth/callback` — reads `accessToken` and `refreshToken` from URL params and stores them
- `/auth/2fa` — reads `partialToken` from URL params, shows 2FA code input, calls `POST /auth/2fa/verify`

### Refresh flow

```
POST /api/auth/refresh
  │
  ├─ SessionService.findValid(token)
  │     SHA-256 hash the token → lookup in sessions table
  │     → not found: 401 "Invalid or expired refresh token"
  │     → expired: delete session, 401
  │
  ├─ UserService.findById(session.userId)
  │
  ├─ SessionService.delete(oldToken)   ← old session removed (rotation)
  │
  └─ issueTokens(userId, email)
        → 201 { accessToken, refreshToken }
```

### 2FA setup flow

```
POST /api/auth/2fa/setup  [protected by JwtGuard]
  │
  ├─ UserService.findById(userId)
  │
  ├─ authenticator.generateSecret()  → random base32 secret
  │
  ├─ UserService.setTotpSecret(userId, secret)  → stored in totp_secret (not yet active)
  │
  └─ authenticator.keyuri(email, issuer, secret) → otpauthUrl
        toDataURL(otpauthUrl) → QR code PNG as base64
        → 201 { otpauthUrl, secret, qrCode }
```

```
POST /api/auth/2fa/enable  [protected by JwtGuard]
  │
  ├─ UserService.findById(userId)
  │     → no totp_secret: 400 "2FA setup not started"
  │
  ├─ authenticator.verify({ token: code, secret })
  │     → invalid: 401 "Invalid 2FA code"
  │
  └─ UserService.enableTotp(userId)  → totp_enabled = true
        → 200 (empty body)
```

### 2FA verification flow (during login)

```
POST /api/auth/2fa/verify  [protected by Pending2faGuard]
  │
  ├─ Pending2faGuard validates Authorization: Bearer <partialToken>
  │     → missing/invalid: 401
  │     → token has no pending2fa: true: 401
  │
  ├─ UserService.findById(userId)
  │     → not found or 2FA not configured: 401
  │
  ├─ authenticator.verify({ token: code, secret: user.totpSecret })
  │     → invalid: 401 "Invalid 2FA code"
  │
  └─ issueTokens(userId, email)
        → 201 { accessToken, refreshToken }
```

### 2FA disable flow

```
POST /api/auth/2fa/disable  [protected by JwtGuard]
  │
  ├─ UserService.findById(userId)
  │     → totp_enabled === false: 400 "2FA is not enabled"
  │
  ├─ authenticator.verify({ token: code, secret })
  │     → invalid: 401 "Invalid 2FA code"
  │
  └─ UserService.disableTotp(userId)  → totp_secret = null, totp_enabled = false
        → 200 (empty body)
```

### Logout flow

```
POST /api/auth/logout  [protected by JwtGuard]
  │
  ├─ JwtGuard validates Authorization: Bearer <accessToken>
  │     → missing/invalid: 401
  │
  └─ SessionService.delete(refreshToken)
        → 200 (empty body)
```

---

## Guards

### JwtGuard

`JwtGuard` (`src/auth/guards/jwt.guard.ts`) protects routes that require full authentication.

**How it works:**
1. Reads the `Authorization: Bearer <token>` header
2. Verifies the JWT signature and expiry using `JwtService.verify()`
3. Rejects tokens with `pending2fa: true` — partial tokens cannot access protected routes
4. Attaches the decoded payload to `request.user`
5. Throws `401` if the header is missing, malformed, expired, or is a partial token

**How to use on a route:**

```ts
import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';

@Get('me')
@UseGuards(JwtGuard)
getProfile(@Request() req) {
    return req.user; // { sub: userId, email, iat, exp }
}
```

### Pending2faGuard

`Pending2faGuard` (`src/auth/guards/pending2fa.guard.ts`) is used exclusively on `POST /auth/2fa/verify`.

**How it works:**
1. Reads the `Authorization: Bearer <token>` header
2. Verifies the JWT signature and expiry
3. Accepts **only** tokens with `pending2fa: true` — rejects full access tokens
4. Attaches the decoded payload to `request.user`

---

## API Endpoints

Base URL: `https://<host>/api`

---

### `POST /auth/register`

Creates a new user account with email and password.

**Request body**

```json
{
  "email": "user@example.com",
  "username": "myusername",
  "password": "securepassword"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | string | Valid email format |
| `username` | string | Non-empty, max 20 characters |
| `password` | string | 8–128 characters |

**Responses**

| Status | Body | Condition |
|---|---|---|
| 201 | `{ accessToken, refreshToken }` | User created |
| 400 | Validation error details | Invalid input |
| 409 | `"Email already in use"` | Duplicate email |
| 409 | `"Username already in use"` | Duplicate username |

```bash
curl -sk -X POST https://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"myusername","password":"securepassword"}'
```

---

### `POST /auth/login`

Authenticates an existing email/password user.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| 201 | `{ accessToken, refreshToken }` | Credentials valid |
| 400 | Validation error details | Invalid input |
| 401 | `"Invalid credentials"` | Wrong email, password, or OAuth-only account |

```bash
curl -sk -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepassword"}'
```

---

### `POST /auth/refresh`

Issues a new token pair using a valid refresh token. The old refresh token is invalidated immediately (rotation).

**Request body**

```json
{
  "refreshToken": "<refresh_token>"
}
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| 201 | `{ accessToken, refreshToken }` | Token rotated |
| 401 | `"Invalid or expired refresh token"` | Token not found, expired, or already used |

```bash
curl -sk -X POST https://localhost/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}'
```

---

### `POST /auth/logout`

Invalidates the refresh token. **Protected by JwtGuard.**

**Headers**

```
Authorization: Bearer <accessToken>
```

**Request body**

```json
{
  "refreshToken": "<refresh_token>"
}
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| 200 | (empty) | Session deleted |
| 401 | `"Missing token"` | No Authorization header |
| 401 | `"Invalid or expired token"` | Access token invalid or expired |

```bash
curl -sk -X POST https://localhost/api/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{"refreshToken":"<refresh_token>"}'
```

---

### `GET /auth/google`

Initiates Google OAuth login. Redirects the browser to the Google consent screen.

```
https://localhost/api/auth/google
```

No request body or headers required. Open in a browser.

---

### `GET /auth/callback/google`

Google redirects here after the user approves. Handled entirely by Passport — do not call this directly.

On success (2FA disabled):
```
302 → ${NEXTAUTH_URL}/auth/callback?accessToken=<jwt>&refreshToken=<token>
```

On success (2FA enabled):
```
302 → ${NEXTAUTH_URL}/auth/2fa?partialToken=<jwt>
```

**Responses**

| Status | Condition |
|---|---|
| 302 | Redirect to frontend (with tokens or partialToken) |
| 409 | Email already registered with a password account |

---

### `POST /auth/2fa/setup`

Generates a TOTP secret and returns a QR code. Does **not** activate 2FA — call `/auth/2fa/enable` after scanning. **Protected by JwtGuard.**

**Headers**

```
Authorization: Bearer <accessToken>
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| 201 | `{ otpauthUrl, secret, qrCode }` | Secret generated |
| 401 | Unauthorized | Invalid or missing access token |

- `otpauthUrl` — `otpauth://totp/...` URI (for manual app entry)
- `secret` — base32 secret key (for manual app entry)
- `qrCode` — `data:image/png;base64,...` (paste in browser address bar to scan)

```bash
curl -sk -X POST https://localhost/api/auth/2fa/setup \
  -H "Authorization: Bearer <accessToken>"
```

---

### `POST /auth/2fa/enable`

Verifies the first TOTP code and activates 2FA. **Protected by JwtGuard.**

**Headers**

```
Authorization: Bearer <accessToken>
```

**Request body**

```json
{ "code": "123456" }
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| 200 | (empty) | 2FA activated |
| 400 | `"2FA setup not started"` | `/auth/2fa/setup` was not called first |
| 401 | `"Invalid 2FA code"` | Wrong TOTP code |

```bash
curl -sk -X POST https://localhost/api/auth/2fa/enable \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

---

### `POST /auth/2fa/verify`

Completes login when 2FA is required. Accepts the partial token from login response. **Protected by Pending2faGuard.**

**Headers**

```
Authorization: Bearer <partialToken>
```

**Request body**

```json
{ "code": "123456" }
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| 201 | `{ accessToken, refreshToken }` | Code valid — full tokens issued |
| 401 | `"Invalid 2FA code"` | Wrong TOTP code |
| 401 | Unauthorized | Missing, expired, or non-partial token |

```bash
curl -sk -X POST https://localhost/api/auth/2fa/verify \
  -H "Authorization: Bearer <partialToken>" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

---

### `POST /auth/2fa/disable`

Deactivates 2FA after verifying the current TOTP code. **Protected by JwtGuard.**

**Headers**

```
Authorization: Bearer <accessToken>
```

**Request body**

```json
{ "code": "123456" }
```

**Responses**

| Status | Body | Condition |
|---|---|---|
| 200 | (empty) | 2FA deactivated |
| 400 | `"2FA is not enabled"` | 2FA was not active |
| 401 | `"Invalid 2FA code"` | Wrong TOTP code |

```bash
curl -sk -X POST https://localhost/api/auth/2fa/disable \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"code":"123456"}'
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | Secret key for signing access tokens | `47d5bc8c...` |
| `JWT_EXPIRES_IN` | Access token lifetime in seconds | `900` (15 min) |
| `NEXTAUTH_URL` | Base URL of the app (used for OAuth callback and frontend redirect) | `https://localhost` |
| `OAUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID | `1012791832136-...` |
| `OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-...` |
| `TOTP_ISSUER` | Issuer name shown in authenticator apps | `ft_transcendence` |
| `MARIADB_HOST` | Database host | `mariadb` |
| `MARIADB_PORT` | Database port | `3306` |
| `MARIADB_USER` | Database user | `User` |
| `MARIADB_PASSWORD` | Database password | `...` |
| `MARIADB_DATABASE` | Database name | `ft_transcendence` |

---

## What Is Not Yet Implemented

| Feature | Planned branch |
|---|---|
| Login rate limiting (5 attempts → delay) | `feat/auth-rate-limit` |
| Frontend `/auth/callback` page (token storage) | frontend branch |
| Frontend `/auth/2fa` page (TOTP code input) | frontend branch |
