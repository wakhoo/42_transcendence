# AUTH.md — Email Authentication

This document covers the email/password authentication implementation: what was built, how each piece works, and how to use the API endpoints.

---

## Overview

The authentication system is split across two NestJS modules:

| Module | Responsibility |
|---|---|
| `UserModule` | Database access — stores and retrieves users |
| `AuthModule` | Business logic — hashing, verification, JWT issuance |

On successful register or login, the API returns a signed **JWT access token**. The token encodes the user's `id` and `email` and expires after the number of seconds defined in `JWT_EXPIRES_IN`.

---

## File Structure

```
src/
├── user/
│   ├── user.entity.ts      # TypeORM entity → maps to the `users` table
│   ├── user.service.ts     # DB queries: create, findByEmail, findByUsername
│   └── user.module.ts      # Registers the repository, exports UserService
└── auth/
    ├── dto/
    │   ├── register.dto.ts # Input shape + validation rules for /register
    │   └── login.dto.ts    # Input shape + validation rules for /login
    ├── auth.service.ts     # Hashing, comparison, JWT signing
    ├── auth.controller.ts  # HTTP routes: POST /auth/register, POST /auth/login
    └── auth.module.ts      # Wires JwtModule with env config, imports UserModule
```

---

## Database — `users` table

Managed by TypeORM via `user.entity.ts`. The `synchronize: true` option in `app.module.ts` creates or updates the table automatically on startup (development only — set to `false` in production).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | INT | PK, AUTO_INCREMENT | |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE | |
| `username` | VARCHAR(20) | NOT NULL, UNIQUE | |
| `password_hash` | VARCHAR(60) | DEFAULT NULL | `NULL` for OAuth-only accounts |
| `created_at` | TIMESTAMP | DEFAULT NOW() | Set by TypeORM `@CreateDateColumn` |

`password_hash` is exactly 60 characters — the fixed output length of bcrypt with the `$2b$` prefix.

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

## Implementation Details

### Registration flow

```
POST /api/auth/register
  │
  ├─ ValidationPipe checks DTO
  │     email     → must be a valid email address
  │     username  → non-empty string, max 20 chars
  │     password  → string, 8–128 chars
  │     → invalid: 400 Bad Request
  │
  ├─ UserService.findByEmail()
  │     → duplicate email: 409 Conflict "Email already in use"
  │
  ├─ UserService.findByUsername()
  │     → duplicate username: 409 Conflict "Username already in use"
  │
  ├─ bcrypt.hash(password, 12)
  │     → produces a 60-char hash, stored in password_hash column
  │
  ├─ UserService.create(email, username, hash)
  │     → INSERT INTO users ...
  │
  └─ JwtService.sign({ sub: id, email })
        → 200 OK { accessToken }
```

### Login flow

```
POST /api/auth/login
  │
  ├─ ValidationPipe checks DTO
  │     email    → must be a valid email address
  │     password → must be a string
  │     → invalid: 400 Bad Request
  │
  ├─ UserService.findByEmail()
  │     → user not found: 401 Unauthorized "Invalid credentials"
  │
  ├─ user.passwordHash === null?
  │     → OAuth-only account: 401 Unauthorized "Invalid credentials"
  │
  ├─ bcrypt.compare(password, user.passwordHash)
  │     → mismatch: 401 Unauthorized "Invalid credentials"
  │
  └─ JwtService.sign({ sub: id, email })
        → 200 OK { accessToken }
```

> Both "user not found" and "wrong password" return the same `401 "Invalid credentials"` message intentionally — this prevents attackers from discovering whether an email is registered.

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
| 200 | `{ "accessToken": "<jwt>" }` | User created successfully |
| 400 | Validation error details | Invalid field format or length |
| 409 | `"Email already in use"` | Email is taken |
| 409 | `"Username already in use"` | Username is taken |

**Example**

```bash
curl -sk -X POST https://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","username":"myusername","password":"securepassword"}'
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST /auth/login`

Authenticates an existing user with email and password.

**Request body**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

| Field | Type | Rules |
|---|---|---|
| `email` | string | Valid email format |
| `password` | string | Non-empty string |

**Responses**

| Status | Body | Condition |
|---|---|---|
| 200 | `{ "accessToken": "<jwt>" }` | Credentials valid |
| 400 | Validation error details | Invalid field format |
| 401 | `"Invalid credentials"` | Email not found, wrong password, or OAuth-only account |

**Example**

```bash
curl -sk -X POST https://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepassword"}'
```

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## JWT Token

The token is signed with `HS256` using `JWT_SECRET` from the environment.

**Payload structure**

```json
{
  "sub": 1,
  "email": "user@example.com",
  "iat": 1782114695,
  "exp": 1782118295
}
```

| Claim | Description |
|---|---|
| `sub` | User ID (primary key) |
| `email` | User email |
| `iat` | Issued at (Unix timestamp) |
| `exp` | Expiry (Unix timestamp, `iat + JWT_EXPIRES_IN`) |

Use this token in the `Authorization` header for protected routes (JWT guard not yet implemented — planned for `feat/auth-guard`):

```
Authorization: Bearer <accessToken>
```

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | Secret key for signing tokens | `47d5bc8c...` |
| `JWT_EXPIRES_IN` | Token lifetime in seconds | `3600` |
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
| JWT guard for protected routes | `feat/auth-guard` |
| Sessions table integration | `feat/auth-session` |
| OAuth provider login (Google, GitHub) | `feat/auth-oauth` |
| Two-factor authentication (TOTP) | `feat/auth-2fa` |
