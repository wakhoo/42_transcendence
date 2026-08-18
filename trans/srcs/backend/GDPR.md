# GDPR.md — User Data Rights API

This document covers the API that lets a user view, correct, export, and delete their own personal data, in line with GDPR articles 15 (access), 16 (rectification), 17 (erasure) and 20 (portability).

---

## Overview

All endpoints live under `/api/user/me` and are implemented in the `UserModule`. Every route requires a valid full access token — no route here accepts a partial (`pending2fa`) token.

| Endpoint | GDPR right | Article |
|---|---|---|
| `GET /user/me` | Access | Art. 15 |
| `PATCH /user/me` | Rectification | Art. 16 |
| `GET /user/me/export` | Portability | Art. 20 |
| `DELETE /user/me` | Erasure ("right to be forgotten") | Art. 17 |

**Scope note:** rectification (`PATCH`) only touches the `users` row itself. Export and erasure go further: `GET /user/me/export` also returns the caller's own chat messages (see below), and `DELETE /user/me` cascades into `sessions`, `channel_members`, and `friendships`, and anonymizes `messages` (see [What actually gets deleted](#what-actually-gets-deleted)). Channel memberships/friendships themselves are still not exportable, only erasable.

Every action here — profile change, export, deletion — is written to an append-only `audit_logs` table via `GdprAuditService` (`user_id`, `action`, `ip`, timestamp; no FK/cascade on `user_id`, so the trail survives the account it refers to being deleted) and triggers a confirmation email via `MailService`. A failed/bounced email is caught and logged — it never blocks the underlying GDPR action.

---

## File Structure

```
src/user/
├── user.entity.ts              # TypeORM entity → maps to the `users` table
├── user.service.ts             # DB queries: create, find*, update, remove, getUserMessage, TOTP/OAuth helpers
├── user.controller.ts          # HTTP routes for all GDPR endpoints (this doc)
├── user.module.ts              # Registers JwtModule + JwtGuard locally (same pattern as ChatModule)
├── gdpr-audit.service.ts        # Writes the append-only audit_logs row for every GDPR-relevant action
├── audit-log.entity.ts          # TypeORM entity → maps to the `audit_logs` table
└── dto/
    ├── update-user.dto.ts       # Input validation for PATCH /user/me
    └── delete-account.dto.ts    # Input validation for DELETE /user/me (password + optional 2FA code)
```

`MailService` (`../mail/mail.service.ts`) sends the confirmation email for each of the three actions below (profile changed / data exported / account deleted).

`UserModule` registers its own `JwtModule.registerAsync(...)` and provides `JwtGuard` (imported from `../auth/guards/jwt.guard`) directly — it does **not** import `AuthModule`. This avoids a circular module dependency (`AuthModule` already imports `UserModule` for `UserService`).

---

## Authentication

Every route is guarded by `JwtGuard`:

```
Authorization: Bearer <accessToken>
```

- Missing/invalid/expired token → `401`
- A `pending2fa` partial token (from an in-progress 2FA login) is rejected → `401`

---

## `GET /user/me`

Returns the caller's own profile.

**Headers**
```
Authorization: Bearer <accessToken>
```

**Response `200`**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "myusername",
  "avatarUrl": null,
  "oauthProvider": null,
  "oauthId": null,
  "totpEnabled": false,
  "createdAt": "2026-07-03T19:57:57.234Z"
}
```

`passwordHash` and `totpSecret` are always stripped from the response — they're never returned to the client, not even to their owner.

```bash
curl -sk https://localhost/api/user/me \
  -H "Authorization: Bearer <accessToken>"
```

---

## `PATCH /user/me`

Corrects profile fields (rectification). All fields are optional — send only what changed.

**Request body**
```json
{
  "email": "new@example.com",
  "username": "newname",
  "avatarUrl": "/avatars/avatar3.png",
  "code": "123456"
}
```

| Field | Rules |
|---|---|
| `email` | optional, valid email format |
| `username` | optional, 3–20 characters |
| `avatarUrl` | optional, must be one of the 20 built-in `/avatars/avatarN.png` paths |
| `code` | required *only* if `email` or `username` is changing **and** the account has 2FA enabled — 6-digit TOTP |

Changing `avatarUrl` alone never requires a 2FA code, even on a 2FA-enabled account — only email/username changes are gated, since those are the fields an attacker with a stolen access token would want to hijack (e.g. to intercept a password-reset email).

**Responses**

| Status | Condition |
|---|---|
| 200 | Updated profile (same shape as `GET /user/me`) |
| 400 | Validation error (bad email format, username length, invalid avatar path) |
| 400 | `"2FA code required"` — changing email/username on a 2FA-enabled account without a `code` |
| 401 | `"Invalid 2FA code"` — wrong or expired TOTP code |
| 409 | `"Email already in use"` — another account owns that email |
| 409 | `"Username already in use"` — another account owns that username |

```bash
curl -sk -X PATCH https://localhost/api/user/me \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"username":"newname"}'
```

---

## `GET /user/me/export`

Returns a portable JSON snapshot of the user's own profile **and their own chat messages** (Art. 20). Requires a valid TOTP code as a query param if the account has 2FA enabled — an access token alone isn't enough to pull a full data export.

**Query params**

| Param | Rules |
|---|---|
| `code` | required only if `totpEnabled` is `true` — 6-digit TOTP |

**Response `200`**
```json
{
  "messages": [
    { "id": 42, "content": "hey", "channel": { "id": 3, "name": "general" }, "createdAt": "..." }
  ],
  "profile": {
    "id": 1,
    "email": "user@example.com",
    "username": "myusername",
    "avatarUrl": null,
    "oauthProvider": null,
    "oauthId": null,
    "totpEnabled": false,
    "createdAt": "2026-07-03T19:57:57.234Z"
  },
  "exportedAt": "2026-07-03T19:57:57.558Z"
}
```

`messages` comes from `UserService.getUserMessage()` — every message this user sent, with its parent channel. Same sensitive-field exclusions on `profile` as `GET /user/me` (no `passwordHash`, no `totpSecret` — exporting an auth secret would be a security bug, not a compliance feature).

**Responses**

| Status | Condition |
|---|---|
| 200 | Export returned |
| 400 | `"2FA code required"` | Account has 2FA enabled but no `code` query param was sent |
| 401 | `"Invalid 2FA code"` | Wrong or expired TOTP code |
| 429 | Too Many Requests | More than 5 calls in 60s (`@Throttle`) |

```bash
curl -sk https://localhost/api/user/me/export \
  -H "Authorization: Bearer <accessToken>"
```

---

## `DELETE /user/me`

Permanently deletes the caller's account (Art. 17). This cannot be undone.

### Confirmation requirements

| Account has... | Must provide | Why |
|---|---|---|
| a password (`passwordHash` set) | `password` | Proves the caller, not just a leaked/stolen access token, controls the account |
| 2FA enabled (`totpEnabled: true`) | `code` (6-digit TOTP) | Otherwise 2FA gives no protection against account deletion — a stolen access token alone could nuke a 2FA-protected account |
| OAuth-only, no 2FA | *(nothing extra)* | No password exists to confirm with; the access token alone is the proof of identity |

Both checks apply independently and are checked in order: password first, then 2FA code, if applicable to the account.

**Request body**
```json
{
  "password": "currentpassword",
  "code": "123456"
}
```

`code` is only required if `totpEnabled` is `true` on the account; omit it otherwise.

**Responses**

| Status | Body | Condition |
|---|---|---|
| 200 | *(empty)* | Account deleted |
| 400 | `"Password confirmation required"` | Account has a password but none was sent |
| 400 | `"2FA code required"` | Account has 2FA enabled but no code was sent |
| 401 | `"Invalid password"` | Wrong password |
| 401 | `"Invalid 2FA code"` | Wrong or expired TOTP code |
| 401 | Unauthorized | Missing/invalid/expired access token |
| 429 | Too Many Requests | More than 5 attempts in 60s (`@Throttle`) |

```bash
curl -sk -X DELETE https://localhost/api/user/me \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"password":"currentpassword","code":"123456"}'
```

### What actually gets deleted

Deletion is a single `DELETE FROM users WHERE id = ?`. Everything downstream relies on existing foreign-key rules — there is no extra cleanup code in `UserService.remove()`:

| Related table | FK behavior | Effect |
|---|---|---|
| `sessions` | `ON DELETE CASCADE` | Refresh-token sessions are deleted — all outstanding refresh tokens are invalidated |
| `channel_members` | `ON DELETE CASCADE` | Chat channel memberships are deleted |
| `friendships` | `ON DELETE CASCADE` | Friend requests/relations (as requester or addressee) are deleted |
| `messages` | `ON DELETE SET NULL` | Messages are **kept** for other members' history, but `sender` becomes `null` (anonymized) |

If chat data ever needs to be included in the `/export` response, or if erasure needs to actively scrub message content (not just null the sender), that's a change to make in `ChatService`/`ChatModule`, not here.

---

## Testing notes

All four endpoints were exercised end-to-end against a running `backend` + `mariadb` container (register → view → correct → export → delete, plus the 2FA-protected delete path with `otplib`-generated codes). Edge cases worth remembering if you touch this code:

- `DELETE /user/me` with **no request body at all** used to 500 (`dto` was `undefined`, not `{}`, so `dto.password` threw). Fixed with optional chaining (`dto?.password`, `dto?.code`) — don't regress this if you refactor the DTO handling.
- OAuth-only accounts (`passwordHash === null`) skip the password check entirely, even if a `password` field is sent.
