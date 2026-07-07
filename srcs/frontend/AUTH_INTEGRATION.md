# Frontend Auth Integration Guide

This document describes everything the frontend needs to implement in order to integrate with the backend authentication system.

Backend base URL (via Nginx): `https://<host>/api`

---

## Overview

The backend handles all authentication logic. The frontend is responsible for:

1. Calling the right API endpoints
2. Storing and managing tokens
3. Attaching the access token to protected requests
4. Implementing the OAuth/2FA redirect landing pages

---

## Token Management

### What you receive after login

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "dc2ff538560415daa55c819519da9f6abbf7b9fc..."
}
```

| Token | Lifetime | Format |
|---|---|---|
| `accessToken` | 15 mins | JWT (HS256) |
| `refreshToken` | 7 days | 64-char hex string |

### Where to store them

Recommended: **memory (React state / context)** for `accessToken` + **localStorage** for `refreshToken`.

Do not store `accessToken` in localStorage — it is readable by any JavaScript on the page (XSS risk).

```ts
// On login success
localStorage.setItem('refreshToken', refreshToken);
// Keep accessToken in memory (React state/context)
```

### How to use the access token

Every request to a protected API endpoint must include:

```
Authorization: Bearer <accessToken>
```

### When the access token expires

Call `/api/auth/refresh` to get a new pair without re-login:

```ts
const res = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
});
const { accessToken, refreshToken } = await res.json();
// Update in-memory accessToken and localStorage refreshToken
```

Refresh token rotation is in effect: every `/refresh` call invalidates the old refresh token and returns a new one. Always save the new `refreshToken`.

### On logout

Call `/api/auth/logout` to invalidate the session on the server, then clear local state:

```ts
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ refreshToken }),
});
localStorage.removeItem('refreshToken');
// Clear in-memory accessToken
```

---

## Pages / Routes to Implement

### 1. `/auth/callback` — Token landing page

**When:** After Google OAuth login (or any future SSO flow)

The backend redirects here with tokens in the URL:
```
https://<host>/auth/callback?accessToken=eyJ...&refreshToken=dc2f...
```

**What to do:**

```ts
// 1. Read tokens from URL
const params = new URLSearchParams(window.location.search);
const accessToken = params.get('accessToken');
const refreshToken = params.get('refreshToken');

// 2. Store them
localStorage.setItem('refreshToken', refreshToken);
// store accessToken in React context/state

// 3. Remove tokens from the URL (security — avoid leaking in logs/history)
window.history.replaceState({}, '', '/auth/callback');

// 4. Redirect to home or dashboard
navigate('/');
```

---

### 2. `/auth/2fa` — Two-factor authentication page

**When:** Login succeeds but the account has 2FA enabled

The backend redirects here with a short-lived partial token:
```
https://<host>/auth/2fa?partialToken=eyJ...
```

This partial token is **not** a full access token. It can only be used on `POST /api/auth/2fa/verify`. It expires in 5 minutes.

**What to do:**

```ts
// 1. Read the partialToken from URL
const params = new URLSearchParams(window.location.search);
const partialToken = params.get('partialToken');

// 2. Render a form asking for the 6-digit TOTP code
//    (user opens Google Authenticator and reads the code)

// 3. On form submit, call /api/auth/2fa/verify
const res = await fetch('/api/auth/2fa/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${partialToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ code: userInputCode }),
});

if (res.ok) {
  const { accessToken, refreshToken } = await res.json();
  // Store tokens and redirect to home
} else {
  // Show "Invalid code" error
}
```

---

## Login Flows

### Email / Password login

```
POST /api/auth/login
Body: { email, password }

Case A — 2FA disabled:
  → 201 { accessToken, refreshToken }
  → Store tokens, go to home

Case B — 2FA enabled:
  → 201 { twoFactorRequired: true, partialToken: "eyJ..." }
  → Redirect to /auth/2fa?partialToken=...
```

```ts
const res = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json();

if ('twoFactorRequired' in data) {
  navigate(`/auth/2fa?partialToken=${data.partialToken}`);
} else {
  // store data.accessToken and data.refreshToken
  navigate('/');
}
```

### Google OAuth login

Simply open this URL in the browser — the backend handles everything:

```
https://<host>/api/auth/google
```

The backend will redirect back to either:
- `/auth/callback?accessToken=...&refreshToken=...` (2FA disabled)
- `/auth/2fa?partialToken=...` (2FA enabled)

---

## Account Management Endpoints

These require a valid `accessToken` in the `Authorization` header.

### Register

```
POST /api/auth/register
Body: { email, username, password }
→ 201 { accessToken, refreshToken }
```

| Field | Rule |
|---|---|
| `email` | Valid email format |
| `username` | Non-empty, max 20 characters |
| `password` | 8–128 characters |

Possible errors: `400` (validation), `409` (email or username already taken)

### Enable 2FA

Two steps:

**Step 1 — Generate QR code**
```
POST /api/auth/2fa/setup
Authorization: Bearer <accessToken>
→ 201 { otpauthUrl, secret, qrCode }
```

- Display `qrCode` (it's a `data:image/png;base64,...` string — set as `<img src={qrCode} />`)
- The user scans it with Google Authenticator
- Alternatively show `secret` for manual entry

**Step 2 — Confirm with first code**
```
POST /api/auth/2fa/enable
Authorization: Bearer <accessToken>
Body: { code: "123456" }
→ 200 (empty)
```

After this, every login will require a 2FA code.

### Disable 2FA

```
POST /api/auth/2fa/disable
Authorization: Bearer <accessToken>
Body: { code: "123456" }
→ 200 (empty)
```

Requires a valid TOTP code from the authenticator app.

---

## Error Reference

| Status | Message | What it means |
|---|---|---|
| `400` | Validation error | Request body failed validation (missing field, bad format) |
| `400` | `"2FA setup not started"` | Called `/2fa/enable` without calling `/2fa/setup` first |
| `400` | `"2FA is not enabled"` | Called `/2fa/disable` but 2FA is off |
| `401` | `"Invalid credentials"` | Wrong email or password |
| `401` | `"Invalid 2FA code"` | Wrong TOTP code |
| `401` | `"Invalid or expired token"` | Access token expired or malformed |
| `401` | `"2FA verification required"` | Tried to use a partial token on a protected route |
| `401` | `"Invalid or expired refresh token"` | Refresh token expired or already used |
| `409` | `"Email already in use"` | Registration with a duplicate email |
| `409` | `"Username already in use"` | Registration with a duplicate username |
| `409` | `"Email already registered with a password account"` | Google OAuth with email that already has a password account |

---

## Environment Variable

| Variable | Value | Used for |
|---|---|---|
| `VITE_API_URL` | `https://localhost/api` | Base URL for all API calls |

Access in code: `import.meta.env.VITE_API_URL`

---

## Summary Checklist

- [ ] `/auth/callback` page — reads tokens from URL, stores them, clears URL params, redirects to home
- [ ] `/auth/2fa` page — reads `partialToken` from URL, shows code input form, calls `/api/auth/2fa/verify`
- [ ] Login form — handles both `{ accessToken, refreshToken }` and `{ twoFactorRequired, partialToken }` responses
- [ ] Google login button — links to `/api/auth/google`
- [ ] Token storage — `accessToken` in memory, `refreshToken` in localStorage
- [ ] Axios/fetch interceptor — attaches `Authorization: Bearer` header on every protected request
- [ ] Token refresh logic — calls `/api/auth/refresh` on 401 response, retries original request
- [ ] Logout — calls `/api/auth/logout`, clears stored tokens
- [ ] 2FA setup UI — shows QR code image, code input field, calls `/api/auth/2fa/setup` then `/api/auth/2fa/enable`
- [ ] 2FA disable UI — shows code input field, calls `/api/auth/2fa/disable`
