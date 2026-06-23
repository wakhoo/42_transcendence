# AUTH.md — Email Authentication

This document covers the email/password authentication implementation: what was built, how each piece works, and how to use the API endpoints.

---

## Overview

The authentication system is split across two NestJS modules:

| Module | Responsibility |
|---|---|
| `UserModule` | Database access — stores and retrieves users |
| `AuthModule` | Business logic — hashing, verification, JWT issuance, session management |

On successful register or login, the API returns two tokens:
- **`accessToken`** — short-lived JWT (15 minutes), used in the `Authorization` header for protected routes
- **`refreshToken`** — long-lived opaque token (7 days), stored hashed in the `sessions` table, used to get a new access token without re-entering credentials

---

## File Structure

```
src/
├── types/
│   └── express.d.ts        # Extends Express Request with user: JwtPayload
├── user/
│   ├── user.entity.ts      # TypeORM entity → maps to the `users` table
│   ├── user.service.ts     # DB queries: create, findByEmail, findByUsername, findById
│   └── user.module.ts      # Registers the repository, exports UserService
└── auth/
    ├── dto/
    │   ├── register.dto.ts # Input validation for /register
    │   ├── login.dto.ts    # Input validation for /login
    │   └── refresh.dto.ts  # Input validation for /refresh and /logout
    ├── guards/
    │   └── jwt.guard.ts    # Validates Bearer token on protected routes
    ├── session.entity.ts   # TypeORM entity → maps to the `sessions` table
    ├── session.service.ts  # Session DB operations: create, findValid, delete
    ├── auth.service.ts     # Register, login, refresh, logout logic
    ├── auth.controller.ts  # HTTP routes for all auth endpoints
    └── auth.module.ts      # Wires JwtModule, TypeORM, SessionService, JwtGuard
```

---

## Database

### `users` table

Managed by TypeORM via `user.entity.ts`. The `synchronize: true` option in `app.module.ts` creates or updates the table automatically on startup (development only — set to `false` in production).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | |
| `username` | VARCHAR(20) | NOT NULL, UNIQUE | |
| `password_hash` | VARCHAR(60) | DEFAULT NULL | `NULL` for OAuth-only accounts |
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
- Lifetime: 15 minutes (`JWT_EXPIRES_IN=900`)
- Payload: `{ sub: userId, email, iat, exp }`
- Usage: `Authorization: Bearer <accessToken>`
- Stateless — verified by signature alone, no DB lookup

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
  └─ issueTokens(userId, email)
        → 201 { accessToken, refreshToken }
```

> "User not found" and "wrong password" both return the same `401 "Invalid credentials"` — this prevents attackers from discovering whether an email is registered.

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

## JWT Guard

`JwtGuard` (`src/auth/guards/jwt.guard.ts`) protects routes that require authentication.

**How it works:**
1. Reads the `Authorization: Bearer <token>` header
2. Verifies the JWT signature and expiry using `JwtService.verify()`
3. Attaches the decoded payload to `request.user`
4. Throws `401` if the header is missing, malformed, or the token is expired

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

---

## API Endpoints

Base URL: `https://<host>/api`

---

### `POST /auth/register`

Creates a new user account.

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

Authenticates an existing user.

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

Invalidates the refresh token. Requires a valid access token. **Protected by JwtGuard.**

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

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | Secret key for signing access tokens | `47d5bc8c...` |
| `JWT_EXPIRES_IN` | Access token lifetime in seconds | `900` (15 min) |
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
| OAuth provider login (Google, GitHub) | `feat/auth-oauth` |
| Two-factor authentication (TOTP) | `feat/auth-2fa` |
