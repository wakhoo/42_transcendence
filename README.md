*This project has been created as part of the 42 curriculum by aboutale([Hamediter](https://github.com/Hamediter)), asdiallo([Xasiyy](https://github.com/Xasiyy)), chajeon([wakhoo](https://github.com/wakhoo)), dancel([Tht4-x](https://github.com/Tht4-x)).*

---

# ft_transcendence

[![Webserv Demo](https://github.com/wakhoo/42_transcendence/blob/main/assets/drawdraw.PNG?raw=true)](https://youtu.be/AhKPoZHwpTA)

> A web-based gaming platform with real-time multiplayer, secure authentication, and social features.

---

<details>
<summary><strong>📑 Table of Contents</strong></summary>

- [Description](#description)
  - [Key Features](#key-features)
- [Instructions](#instructions)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Environment Variables](#environment-variables)
  - [Available Commands](#available-commands)
- [Docker Architecture](#docker-architecture)
  - [Container overview](#container-overview)
  - [What each container does](#what-each-container-does)
  - [Network isolation](#network-isolation)
  - [Healthchecks](#healthchecks)
- [Team Information](#team-information)
- [Project Management](#project-management)
  - [Work Organization](#work-organization)
  - [Tools Used](#tools-used)
  - [Branch Strategy](#branch-strategy)
- [Technical Stack](#technical-stack)
  - [Frontend](#frontend)
  - [Backend](#backend)
  - [Database](#database)
  - [Infrastructure & Security](#infrastructure--security)
- [Database Schema](#database-schema)
  - [Tables](#tables)
  - [Relationships](#relationships)
- [Features List](#features-list)
- [Modules](#modules)
  - [Mandatory Requirements](#mandatory-requirements)
  - [Chosen Modules](#chosen-modules)
  - [Point Calculation](#point-calculation)
- [Individual Contributions](#individual-contributions)
  - [dancel — Product Owner + Developer](#dancel--product-owner--developer)
  - [chajeon — Project Manager + Developer](#chajeon--project-manager--developer)
  - [asdiallo — Tech Lead + Developer](#asdiallo--tech-lead--developer)
  - [aboutale — Developer](#aboutale--developer)
- [Backend commands — help / cheat sheet](#backend-commands--help--cheat-sheet)
- [Resources](#resources)
  - [Documentation](#documentation)
  - [Security Standards & Password Policy](#security-standards--password-policy)
  - [AI Usage](#ai-usage)
- [Team Information (aboutale)](#team-information-aboutale)

</details>

---

## Description

**DrawDraw** is a web project built as the final project ft_transcendence of the 42 Common Core.

### Key Features
- Real-time drawing & guessing game: one player gets a keyword and draws it, others guess in the chat
- Multiplayer support with remote players (2+) and live reconnection
- Secure authentication: email/password (bcrypt), OAuth 2.0, and 2FA (TOTP)
- Social features: chat, profile, friends list, and online status
- Hardened infrastructure: Docker network isolation, HTTPS/TLS 1.3, WAF/ModSecurity

---

## Instructions

### Prerequisites

| Tool | Version |
|------|---------|
| Docker | 24.0+ |
| Docker Compose | 2.0+ |
| Make | any |

### Setup

1. Clone the repository
```bash
git clone [repository URL]
cd ft_transcendence
```

2. Create your environment file
```bash
cp .env.example .env
cp seed.env.example seed.env
# Fill in the required values in .env
```

3. Run the project
```bash
make
# or
docker compose -f ./srcs/docker-compose.yml up --build
```

4. Open in browser
```
https://localhost:8443
```

### Environment Variables

Copy `seed.env.example` to `seed.env` and fill in the values:

```env
JWT_SECRET=
NESTAUTH_SECRET=

MARIADB_ROOT_PASSWORD=
MARIADB_PASSWORD=

OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=

TOTP_ISSUER=ft_transcendence
GMAIL_APP_PASSWORD=
```

Copy `.env.example` to `.env` and fill in the values:

```env
# Database — MariaDB
MARIADB_HOST=mariadb
MARIADB_PORT=3306
MARIADB_ROOT_PASSWORD=
MARIADB_USER=
MARIADB_PASSWORD=
MARIADB_DATABASE=ft_transcendence

# Mail
GMAIL_USER=

# NESTAUTH_URL=https://dancel.42.fr
NESTAUTH_URL=https://localhost

# JWT
JWT_EXPIRES_IN=3600

# Frontend — React
VITE_API_URL=https://localhost/api
VITE_WS_URL=wss://localhost/ws

# Vault
VAULT_ADDR=https://vault:8200
```

### Available Commands

| Command | Description |
|---------|-------------|
| `make` | Build and start all containers |
| `make down` | Stop and remove containers |
| `make re` | Full rebuild from scratch |
| `make logs` | View live logs |
| `make log SERVICE=backend` | View logs for a specific service |
| `make clean` | Remove containers and volumes |
| `make fclean` | Remove containers, volumes, images and host data |

---

## Docker Architecture

![Docker Architecture Flow Chart](assets/FlowChart.png)

### Container overview

| Container | Built from | External port | Role |
|-----------|-----------|---------------|------|
| `nginx` | `srcs/nginx/` | 8443 (HTTPS), 8080 (HTTP → redirects to 8443) | Reverse proxy + WAF — only entry point |
| `frontend` | `srcs/frontend/` | none | React/Vite UI |
| `backend` | `srcs/backend/` | none | NestJS REST API + WebSocket gateways |
| `mariadb` | `srcs/mariadb/` | none | Relational database |
| `vault` | `srcs/vault/` | none | HashiCorp Vault — secrets management |

### What each container does

**`nginx`** — The only container reachable from the internet. Every request passes through it. It routes `/api/*` and `/socket.io` to the backend, and everything else to the frontend. ModSecurity runs as a Web Application Firewall to block SQLi, XSS, and other OWASP Top 10 attacks before they reach the app.

**`frontend`** — Serves the React application compiled by Vite. Not exposed directly — nginx proxies requests to it on the internal Docker network.

**`backend`** — The NestJS API. Handles all business logic, exposes routes under `/api`, and manages WebSocket connections via two integrated NestJS gateways over Socket.IO (`ChatGateway` on `/chat`, `GameGateway` on `/game`, both reached through nginx's `/socket.io` route). Talks to `mariadb` for data persistence and to `vault` for secrets. Not exposed externally — nginx forwards matching requests to it.

**`vault`** — HashiCorp Vault. Stores app secrets, reachable only from `backend` over the isolated `vault_net` network. `backend`'s `vault-loader.ts` logs in via AppRole and merges the KV secret into `process.env` before NestJS boots; it no-ops when `VAULT_ADDR` is unset, so local dev without a running Vault still works off a plain `.env`.

**`mariadb`** — Stores all persistent data. Accessible only from the `backend` container through the isolated `db` network. Data survives container restarts via the `mariadb_data` Docker volume.

### Network isolation

Four Docker networks enforce strict separation between layers:

| Network | Members | Purpose |
|---------|---------|---------|
| `dmz` | nginx | Faces the internet |
| `internal` | nginx, frontend, backend | Internal app traffic |
| `db` | backend, mariadb | Database access only |
| `vault_net` | backend, vault | Secrets management |

A container can only reach another container if they share a network. `mariadb` is on `db` only — the frontend can never reach the database, even accidentally.

### Healthchecks

Each container declares a healthcheck so Docker knows when it is truly ready:

| Container | Check | What it verifies |
|-----------|-------|-----------------|
| `nginx` | `nginx -t` | Config is valid and process is running |
| `frontend` | `curl http://localhost:3000` | UI server responds |
| `backend` | `curl http://localhost:3000/api/health` | NestJS API responds |
| `mariadb` | `mariadb-admin ping` | Database accepts connections |
| `vault` | `vault status` | Vault is unsealed and responding |

`backend` waits for `mariadb` to report healthy before starting, preventing startup crashes when the database is not yet ready.

---

## Team Information

| Member | Role | Responsibilities |
|--------|------|-----------------|
| dancel | Product Owner + Developer | Multi-User Simultaneous Support, WebSocket Real-Time Features, User Interaction (Chat + Profile + Friends), ORM, Content Moderation AI, Advanced Chat Features |
| chajeon | Project Manager + Developer | Team coordination; auth (bcrypt), HTTPS, Privacy Policy/ToS, README, OAuth 2.0, 2FA, WAF/ModSecurity + Vault, GDPR Compliance |
| asdiallo | Tech Lead + Developer | Architecture; web app scaffold, Docker single-command deployment, responsive frontend, input validation, full-stack framework usage, frontend/backend framework, Standard User Management & Auth |
| aboutale | Developer | Web-Based Game, Remote Players, Multiplayer (3+ Players), Spectator Mode |

---

## Project Management

### Work Organization
- Tasks divided by module and role
- Weekly sync meetings
- Task tracking via Google Sheet

### Tools Used
- **Issue Tracker**: Google Sheet
- **Communication**: Slack
- **Version Control**: Git — https://github.com/wakhoo/42_transcendence

### Branch Strategy
- `main` — stable, production-ready
- `feat/[feature-name]` — feature branches
  - ex. `feat/user-auth`
- `fix/[issue]` — bug fixes
  - ex. `fix/cors-error`
- Pull requests require 1 approval before merging

---

## Technical Stack

### Frontend
| Technology | Reason |
|-----------|--------|
| React | Component-based UI, large ecosystem, team familiarity |
| Tailwind CSS | Utility-first CSS, responsive design |

### Backend
| Technology | Reason |
|-----------|--------|
| Nest.js | Full-stack framework, API routes, SSR support |
| TypeORM | NestJS integration, TypeScript decorators, MariaDB support |

### Database
| Technology | Reason |
|-----------|--------|
| MariaDB | MySQL-compatible, reliable, lightweight |

### Infrastructure & Security
| Technology | Reason |
|-----------|--------|
| Docker + Docker Compose | Containerization, single-command deployment |
| Nginx + ModSecurity | Reverse proxy, WAF with OWASP CRS |
| HTTPS / TLS 1.3 | Encrypted external connections, latest TLS standard |
| HashiCorp Vault | Secret and credential management |

---

## Database Schema

![Database Schema](assets/DBschema.png)

### Tables

#### users
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key — internal only, never exposed to clients (see `public_id`) |
| public_id | VARCHAR(36) | Unique UUID exposed to clients in place of the internal `id`, so sequential integer IDs are never handled by the frontend or sent over chat/game events |
| email | VARCHAR | Unique, used for login |
| password_hash | VARCHAR | bcrypt hashed password (nullable for OAuth users) |
| username | VARCHAR | Display name |
| avatar_url | VARCHAR | Profile picture URL |
| profile_color | VARCHAR | UI accent color |
| oauth_provider | VARCHAR | OAuth provider name, e.g. `google` (nullable — null for password accounts) |
| oauth_id | VARCHAR | Provider-side account ID (nullable) |
| totp_secret | VARCHAR | 2FA seed (nullable) |
| totp_enabled | BOOLEAN | 2FA toggle |
| created_at | TIMESTAMP | Account creation date |

#### sessions
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| token_hash | VARCHAR | Hashed refresh token |
| expires_at | DATETIME | Refresh token expiry |
| created_at | TIMESTAMP | Session creation date |
| user_id | INT | FK → users (cascade delete) |

#### channels
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| name | VARCHAR(50) | Unique channel name |
| type | ENUM | `general`, `game`, or `dm` |
| is_private | BOOLEAN | Private channel flag |
| password_hash | VARCHAR | bcrypt-hashed join password (nullable) |
| max_members | INT | Member cap (nullable) |
| created_at | TIMESTAMP | Creation date |

#### channel_members
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| role | ENUM | `admin`, `member`, `spec`, or `drawer` |
| muted_until | DATETIME | Mute expiry (nullable) |
| warnings | INT | Moderation warning count |
| joined_at | TIMESTAMP | Join date |
| user_id | INT | FK → users |
| channel_id | INT | FK → channels |

#### match
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| channel_id | INT | Game room this match belongs to — plain column, not a FK |
| scores | JSON | Per-player score map (`{ userId: score }`) |
| created_at | TIMESTAMP | Match creation date |

#### messages
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| content | TEXT | Message body |
| created_at | TIMESTAMP | Send date |
| sender_id | INT | FK → users (nullable, system messages) |
| channel_id | INT | FK → channels |

#### friendships
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| status | ENUM | `pending`, `accepted`, or `blocked` |
| created_at | TIMESTAMP | Request date |
| requester_id | INT | FK → users |
| addressee_id | INT | FK → users |

#### words
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| content | VARCHAR | Unique drawing keyword, drawn from at random each round |

#### bad_words
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| word | VARCHAR | Banned word or phrase |

#### audit_logs
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | References users.id — plain column, not a FK (no cascade, so the trail survives account deletion) |
| action | ENUM | `data_changed`, `data_exported`, or `account_deleted` (GDPR audit trail) |
| ip | VARCHAR(45) | Request IP (nullable) |
| created_at | TIMESTAMP | Event date |

#### verification_codes
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | References users.id — plain column, not a FK (short-lived, no cascade needed) |
| code_hash | VARCHAR | SHA-256 hash of the one-time 6-digit code (never stored in plaintext) |
| expires_at | DATETIME | Code expiry, 10 minutes after issue |
| created_at | TIMESTAMP | Issue date |

### Relationships
- users 1 — N sessions (refresh tokens, cascade delete)
- users 1 — N channel_members — N channels (join table)
- users 1 — N messages (as sender)
- users 1 — N friendships (as requester or addressee)
- users 1 — N audit_logs (by user_id, no FK constraint — see above)
- users 1 — N verification_codes (by user_id, no FK constraint — see above)
- channels 1 — N messages
- channels 1 — N channel_members
- channels 1 — N match (by channel_id, no FK constraint — game rounds played in that room)

---

## Features List

| Feature | Description | Developer(s) |
|---------|-------------|--------------|
| User Registration & Login | Email + password auth with bcrypt | chajeon |
| HTTPS / TLS 1.3 | All connections encrypted | chajeon |
| Docker Infrastructure | 4-network isolation, single-command run | asdiallo |
| WAF / ModSecurity + HashiCorp Vault | OWASP CRS, SQLi/XSS protection, secrets management | chajeon |
| OAuth 2.0 | Google social login | chajeon |
| 2FA Authentication | TOTP-based with QR code registration | chajeon |
| GDPR Compliance | Data request, deletion, export | chajeon |
| User Management & Auth | Profile, avatar, friends list, online status | asdiallo |
| Frontend & Backend Frameworks | React + NestJS | asdiallo |
| WebSocket Real-Time | Socket.IO gateway with JWT auth, presence tracking, multi-tab support, typing indicators | dancel |
| Chat + Profile + Friends | Channels (public/private/DM), friends system (request/accept/reject), block/unblock | dancel |
| Content Moderation AI | Bad-word dictionary seeded at startup, per-member warning counter, auto-filter on every message | dancel |
| Advanced Chat | Timed mute, password-protected channels, game invite via WebSocket, spectator/drawer roles | dancel |
| Drawing & Guessing Game | Real-time multiplayer drawing game | aboutale |
| Remote Players | Two players on separate machines with reconnection | aboutale |
| Multiplayer (3+) | 3 or more simultaneous players | aboutale |
| Spectator Mode | Watch live games | aboutale |
| Privacy Policy Page | Accessible from footer | chajeon |
| Terms of Service Page | Accessible from footer | chajeon |

---

## Modules

### Mandatory Requirements

| Requirement | Assigned To | Description |
|---|---|---|
| Web Application (Frontend + Backend + DB) | asdiallo | Full web app with frontend, backend, and database |
| Docker Single-Command Deployment | asdiallo | Run entire app with one command (`docker compose up`) |
| Email + Password Authentication (bcrypt) | chajeon | Secure login with hashed and salted passwords |
| HTTPS | chajeon | All external connections must use HTTPS |
| Privacy Policy & Terms of Service Pages | chajeon | Accessible pages with real content, not placeholders |
| Multi-User Simultaneous Support | dancel | Multiple users active at the same time without conflicts |
| Responsive Frontend | asdiallo | Clear, accessible UI across all devices |
| Input Validation (Frontend + Backend) | asdiallo | All forms validated on both client and server side |
| README.md | chajeon | Detailed doc: roles, stack, schema, modules, contributions |

### Chosen Modules

| Module | Category | Type | Points | Developer(s) | Dependencies |
|--------|----------|------|--------|--------------|--------------|
| Full-Stack Framework Usage | Web | Major | 2 | asdiallo | — |
| WebSocket Real-Time Features | Web | Major | 2 | dancel | — |
| User Interaction (Chat + Profile + Friends) | Web | Major | 2 | dancel | — |
| Standard User Management & Auth | User Management | Major | 2 | asdiallo | — |
| WAF/ModSecurity + HashiCorp Vault | Cybersecurity | Major | 2 | chajeon | — |
| Web-Based Game | Gaming & UX | Major | 2 | aboutale | — |
| Remote Players | Gaming & UX | Major | 2 | aboutale | Requires a game module |
| Multiplayer (3+ Players) | Gaming & UX | Major | 2 | aboutale | Requires a game module |
| Frontend Framework Only | Web | Minor | 1 | asdiallo | — |
| Backend Framework Only | Web | Minor | 1 | asdiallo | — |
| ORM | Web | Minor | 1 | dancel | — |
| OAuth 2.0 Authentication | User Management | Minor | 1 | chajeon | — |
| 2FA (Two-Factor Authentication) | User Management | Minor | 1 | chajeon | — |
| Content Moderation AI | Artificial Intelligence | Minor | 1 | dancel | — |
| Advanced Chat Features | Gaming & UX | Minor | 1 | dancel | Requires User Interaction module |
| Spectator Mode | Gaming & UX | Minor | 1 | aboutale | Requires a game module |
| GDPR Compliance | Data & Analytics | Minor | 1 | chajeon | — |
| **Total** | | | **25** | | |

### Point Calculation
- Major modules (2pt each): 8 × 2 = 16pt
- Minor modules (1pt each): 9 × 1 = 9pt
- **Total: 25pt** (minimum required: 14pt)

---

## Individual Contributions

### dancel — Product Owner + Developer

**Multi-User Simultaneous Support** (mandatory)
- `socketUserMap` — maps each `socket.id` to a `userId`, tracking all active connections across tabs
- Multi-tab detection: a user is only marked offline when their last socket disconnects
- Presence broadcasts: `presenceChanged` (online/offline) pushed to all connected clients in real time

**WebSocket Real-Time Features** (Major)
- Socket.IO gateway at `/chat` namespace with JWT authentication at connection time
- Partial tokens (`pending2fa`) rejected at the WebSocket level
- Events received: `joinChannel`, `leaveChannel`, `sendMessage`, `sendDm`, `typing`
- Events emitted: `newMessage`, `userTyping`, `presenceChanged`, `ready`
- Game mode: dual room join (`channel_${id}` for chat events, `${id}` for game events)
- `emitToUser()`: delivers events to all sockets of a given user (DM, game invites)

**User Interaction: Chat + Profile + Friends** (Major)
- Channels: create, join (with optional password), leave, list, message history
- Direct messages: auto-creates a private DM channel on first message between two users
- Friends system: send/accept/reject friend request, list friends, list pending requests
- Block/unblock: prevents DMs and channel interactions with blocked users
- Channel admin: kick member, timed mute (with expiry datetime), invite, set password, set privacy, set max-members, delete channel

**ORM** (Minor)
- TypeORM entities: `Channel`, `ChannelMember`, `Message`, `Friendship`, `BadWord`
- Relations: `@OneToMany` / `@ManyToOne` with `CASCADE` deletes
- `@Unique` constraints, enum columns, `@CreateDateColumn`

**Content Moderation AI** (Minor)
- `BadWord` entity with a dictionary seeded automatically on startup
- Message content checked before storage and broadcast; violations trigger warnings
- Warning counter per member (`warnings` field on `ChannelMember`)

**Advanced Chat Features** (Minor)
- Timed mute: `mutedUntil` datetime stored per member, enforced on every message
- Password-protected channels (bcrypt-hashed)
- Game invite via WebSocket `game_invite` event, delivered via `emitToUser`
- Private game room join code: `GET /chat/find-private-game/:code`
- Spectator (`spec`) and drawer roles in `channel_members`
- Typing indicators: `typing` event → `userTyping` broadcast to channel members

### chajeon — Project Manager + Developer

**Team Coordination**
- Meeting facilitation, task tracking (Google Sheet), progress reporting across the 4-person team
- Docker infrastructure: 4-network isolation (`dmz`, `internal`, `db`, `vault_net`), `docker-compose.yml`, Makefile targets (`up`, `down`, `re`, `logs`, `clean`, `fclean`)

**Email + Password Authentication with bcrypt** (mandatory)
- `bcrypt` hashing at cost factor 12 (`auth.service.ts`), never storing or logging plaintext passwords
- `register()` rejects on duplicate email *or* username before hashing; `login()` returns either a token pair or `{ twoFactorRequired: true, partialToken }` when the account has TOTP enabled
- Refresh tokens are opaque and tracked server-side via `SessionService`; `/auth/refresh` deletes the old session and issues a new pair (rotation, not reuse)
- `@Throttle` limits login, password change, and account deletion to 5 attempts / 60s per the project's brute-force policy

**HTTPS / TLS 1.3** (mandatory)
- `nginx.conf` restricts `ssl_protocols` to TLS 1.3 only, terminates TLS for every service, and hard-redirects port 8080 → 8443
- Security headers on every response: HSTS (1 year, includeSubDomains), CSP (`default-src 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- Extra nginx-level blocklist for dotfiles (`.env`, `.git`) and backup/config extensions (`.bak`, `.sql`, `.conf`, …) as a second layer beneath ModSecurity

**Privacy Policy & Terms of Service** (mandatory)
- Static pages (`privacy-policy.html`, `terms-of-service.html`) served by the frontend and exposed at dedicated nginx locations so they're reachable without hitting the SPA router or the backend

**OAuth 2.0 Authentication** (Minor)
- Google login via `passport-google-oauth20` (`google.strategy.ts`); callback route lives under `/api/auth/callback/google` but is nginx-rewritten so it's reachable at the shorter `/auth/callback/google`
- `googleLogin()` looks up the user by `(provider, oauthId)` first, and only on a fresh sign-in checks for an existing password account with the same email — throwing `ConflictException` instead of silently merging accounts
- Auto-generates a unique username from the email's local part, appending a numeric suffix on collision
- Google logins go through the same TOTP branch as password logins, so 2FA is enforced regardless of how the user authenticated

**2FA / TOTP Implementation** (Minor)
- `otplib` + `qrcode`: `POST /auth/2fa/setup` generates a secret, an `otpauth://` URI, and a scannable QR code as a data URL
- `/auth/2fa/enable` requires the new TOTP code *plus* the account's existing re-auth factor — current password if one is set, or an emailed one-time code if the account has neither a password nor TOTP yet (a pure OAuth account); `/2fa/disable` requires a valid current TOTP code — you can't turn 2FA on or off just by being logged in
- A login from a 2FA-enabled account gets a short-lived (5 min) `pending2fa` JWT instead of real tokens; `Pending2faGuard` accepts *only* pending tokens and `JwtGuard` rejects them outright, so a partial token can't be replayed against any other authenticated route
- Sensitive account actions (email/username change, password change, 2FA enable, data export, account deletion) re-check whichever factor the account actually has — current password and/or TOTP code
- **OAuth-only re-auth gap**: an account signed up via Google with no password and no 2FA had *no* re-auth factor at all, so a stolen JWT alone was enough to change the email/username, set a first password (a durable login backdoor bypassing Google entirely), enable 2FA with an attacker-chosen secret (locking the real owner out of Google login, which also enforces TOTP), or delete the account outright. Closed by emailing a 6-digit one-time code (`verification_codes` table — SHA-256 hashed, 10-minute TTL, single-use) that these accounts must enter before any of those actions proceed

**Concurrency & Data-Exposure Hardening** (bug fixes, found via mentor exam-week `curl` load testing)
- `POST /auth/register`, `/chat/create-game`, and `/chat/friends` each did a check-then-insert (SELECT to see if a row already existed, then INSERT) with no transaction; firing ~15 identical requests at once let them all pass the check and crash with an unhandled `500` on the database's unique-constraint violation
- `QueryFailedFilter` (`common/filters/query-failed.filter.ts`), registered globally in `main.ts`, catches MariaDB's duplicate-entry error (`errno 1062`) and converts it to a clean `409 Conflict` instead of a `500`
- `POST /chat/channels/join` returned the raw `ChannelMember` entity with its eager-loaded `user` relation, leaking every joining member's email, OAuth provider/ID, and internal numeric ID to the room; fixed by routing the response through the same `toPublicUser()` sanitizer already used for friend/invite responses

**WAF/ModSecurity + HashiCorp Vault** (Major)
- ModSecurity runs as an nginx module in front of every route, loaded with the OWASP Core Rule Set (`crs-setup.conf`, `main.conf`)
- `custom-exclusions.conf` narrowly scopes three documented false positives instead of disabling rules globally: Swagger UI's inline `<script>` tags at `/api/docs`, Socket.IO's upgrade-handshake headers at `/socket.io`, and Google's OAuth `scope` query param (`...profile...`) which CRS's LFI rule (930120) misreads as a `~/.profile` dotfile read attempt
- `vault-loader.ts` logs into Vault via AppRole (role/secret ID files mounted as Docker secrets), reads the app's KV secret over HTTPS, and merges it into `process.env` before NestJS's `ConfigModule` boots — no-ops when `VAULT_ADDR` is unset so local dev without a running Vault still works off a plain `.env`
- Vault sits on its own `vault_net` network, reachable only from `backend`

**GDPR Compliance** (Minor)
- `GdprAuditService` writes an append-only `audit_logs` row (`data_changed`, `data_exported`, or `account_deleted`) on every profile edit, password change, export, and deletion; `user_id` is intentionally a plain column with no FK/cascade so the trail survives the account it refers to being deleted
- `GET /user/me/export` (Article 20 — data portability) returns the user's profile and message history as JSON; gated behind a TOTP re-check when 2FA is enabled
- `DELETE /user/me` (Article 17 — right to erasure) requires password confirmation (and TOTP code, if enabled) — or an emailed one-time verification code for OAuth-only accounts — before the account is removed
- `MailService` sends a confirmation email for each of the three actions (profile changed / data exported / account deleted), plus the one-time verification codes described above; mail failures are caught and logged so a bounced email never blocks the underlying GDPR action itself

**README.md** (mandatory)
- Authored and maintains the full project README: setup instructions, architecture diagrams, DB schema, module list, and this contributions section

**Challenges**
- ModSecurity's stock CRS flagged legitimate traffic (Swagger's inline scripts, Socket.IO's handshake, Google's OAuth callback) as attacks; resolved by writing narrowly-scoped exclusions per route instead of weakening the WAF project-wide
- Keeping 2FA state consistent across login and profile-editing flows — every endpoint that could leak or change account-critical data (email, password, export, delete) needed its own TOTP re-check, not just the login path
- Internal numeric user IDs kept leaking to clients — a mentor's testing found `POST /chat/channels/join` returning a raw `ChannelMember` with its full `user` relation (email, OAuth provider/ID, internal numeric ID) attached; fixed by routing it through the existing public-user sanitizer, on top of an earlier project-wide pass that replaced internal IDs with `publicId` (UUID) across chat/game DTOs and events so clients never handle sequential integer IDs at all
- OAuth-only accounts turned out to have no re-auth factor at all for account-critical changes, unlike password/2FA accounts — closed by adding an emailed one-time verification code as their equivalent factor

### asdiallo — Tech Lead + Developer

**Overall Architecture & Stack Decisions**
- Chose the React + NestJS stack and laid out the initial project structure that the rest of the team built on

**Web Application Scaffold (Frontend + Backend + DB)** (mandatory)
- Bootstrapped the React frontend and NestJS backend boilerplate, with an initial backend `/health` endpoint and dev proxy between the two
- Set up the backend's TypeScript/ESLint config and `src/` structure

**Docker Single-Command Deployment** (mandatory)
- Multi-stage `Dockerfile` for the backend service; frontend, WebSocket, and MariaDB services wired into `docker-compose.yml`
- Nginx gateway configured for HTTP + WebSocket proxying, with healthchecks on every service so `docker compose up` brings up a working stack in one shot
- Makefile targets refined for day-to-day usage

**Responsive Frontend** (mandatory)
- Tailwind-based responsive layout work across pages (Dashboard, Profile)

**Input Validation, Frontend + Backend** (mandatory)
- Global `ValidationPipe({ whitelist: true })` in `main.ts` — every incoming DTO is validated and unknown fields are stripped before reaching a handler
- Auth/user DTOs (`register.dto.ts`, `login.dto.ts`, `update-user.dto.ts`, …) built with `class-validator` decorators (`IsEmail`, `IsString`, `Length`, …), mirrored by matching form validation on the frontend

**Full-Stack Framework Usage** (Major)
- End-to-end React + NestJS setup: scaffold, build tooling, and dev/prod scripts

**Frontend Framework Only** (Minor) / **Backend Framework Only** (Minor)
- React app structure (routing, pages) and NestJS module structure each usable independently, satisfying both standalone-framework requirements

**Standard User Management & Auth** (Major)
- Login / SignUp pages, plus the Google OAuth callback flow (`AuthCallbackPage.tsx`)
- Profile page + `ProfileContent` component: avatar, profile color, editable fields
- Online presence: fetch-all-users and live online/offline status on the Dashboard

**Avatar** (major)
- Users can choose an avatar from a predefined set.
- The user has a default avatar defined by the random color assigned to them.

**Challenges**

**Learning curve & tech stack decisions**
A big part of the difficulty was upstream of any code: understanding a full stack I had no prior experience with (React, NestJS, TypeORM, Docker, Vault...) well enough to make informed decisions about which technologies would actually work well together, rather than just picking popular names. The initial project setup — structuring the repo, wiring the Docker Compose services, getting the pieces to talk to each other — was a challenge on its own, since it required a level of architectural organization I couldn't yet judge with confidence, not knowing any of these technologies going in.

### aboutale — Developer

**Web-Based Game** (Major)
- Backend game engine — `game.gateway.ts` + `game.service.ts`: turn rotation, timer events, word selection, hint generation, and dynamic scoring
- Interactive Canvas (frontend): HTML5 Canvas integration that captures, scales, and broadcasts drawing coordinates in real time; batches stroke events instead of emitting per-pixel to keep the socket from congesting
- Real-time dashboard: UI wired to backend WebSocket events (`channel_deleted`, `presenceChanged`) so the frontend strictly mirrors DB state; responsive layout and profile modals built with Tailwind CSS

**Remote Players** (Major)
- Graceful handling of disconnects mid-game: admin rights transfer to another player, active room timers are cleared, and an empty game is auto-canceled instead of left hanging

**Multiplayer, 3+ Players** (Major)
- Turn rotation and scoring generalized to N simultaneous players in the same room, not just 1v1

**Spectator Mode** (Minor)
- Spectator role integrated into the game/room state (view-only — no drawing or guessing rights)

**Frontend Anti-Crash System**
- Strict `Array.isArray()` validation before updating React state, so an HTTP 429 error payload (object, not array) can't reach `.map()` and crash the UI during high server load

**Challenges**
- Ghost timers / race conditions: a player kicked or disconnected at the exact moment a round timer fired could trigger `setTimeout` callbacks for an already-canceled game, sending empty hints or crashing the round — resolved with state checks before running delayed callbacks and clearing all active timers when a room empties or a game force-closes
- Canvas performance: broadcasting every pixel move over WebSockets congested the network — resolved by batching coordinate events and emitting strokes instead of raw points
- "White Screen of Death": rapid UI interactions tripped the backend Throttler, replacing expected JSON arrays with error objects and breaking `.map()` — resolved by validating array shape before updating state, letting the UI ignore error payloads and freeze gracefully until the rate limit expired

---

## Backend commands — help / cheat sheet

> All commands below are run **inside `srcs/backend/`** (the folder that holds `package.json`).
> Move there first: `cd srcs/backend`

---

## 1. Setup

### `npm install`
**What it does:** reads `package.json` and downloads every dependency into a local `node_modules/` folder.
**When to use it:** the first time you set up the project, after cloning the repo, or any time `package.json` changes (a new dependency was added). You cannot run or build anything before doing this once.

---

## 2. Running the server (development)

### `npm run start:dev`
**What it does:** runs `nest start --watch`. It starts the backend HTTP server **and** watches your files: every time you save, it automatically recompiles and restarts. The server listens on `http://localhost:3000`.
**When to use it:** this is your main command while coding. Keep it running in a terminal during development.

### `npm run start`
**What it does:** starts the server **once**, without watching files. If you change code you have to stop it and start it again manually.
**When to use it:** rarely — only when you want a single run without auto-reload.

---

## 3. Building for production

### `npm run build`
**What it does:** runs `nest build`. It compiles your TypeScript (`src/`) into plain JavaScript inside a `dist/` folder.
**When to use it:** before running the production version, or when the Docker image is built.

### `npm run start:prod`
**What it does:** runs `node dist/main` — the already-compiled JavaScript. It does **not** recompile, so you must run `npm run build` first.
**When to use it:** to run the optimized version, typically inside the Docker container.

---

## 4. Code quality

### `npm run lint`
**What it does:** runs ESLint on all `.ts` files in `src/` and auto-fixes (`--fix`) everything it can (unused imports, style issues, common mistakes).
**When to use it:** before committing, to keep the code clean and catch errors early.

### `npm run format`
**What it does:** runs Prettier on all `.ts` files in `src/` and rewrites them to follow a consistent style (quotes, spacing, commas).
**When to use it:** before committing, or whenever the formatting drifts.

---

## 5. Generating NestJS code (scaffolding)

> These use the NestJS CLI. Since it is a local dev dependency, prefix with `npx`.

### `npx nest g controller <name>`
**What it does:** creates a new controller (and its folder) with the boilerplate already written.
**Example:** `npx nest g controller users` → creates `src/users/users.controller.ts`.

### `npx nest g module <name>`
**What it does:** creates a new module to group related features.
**Example:** `npx nest g module users`.

### `npx nest g service <name>`
**What it does:** creates a new service (where business logic lives).
**Example:** `npx nest g service users`.

### `npx nest g resource <name>`
**What it does:** generates a full feature at once — module, controller, service, and basic CRUD — and asks a few questions interactively.
**When to use it:** to bootstrap a complete feature quickly.

---

## 6. Adding new dependencies

### `npm install <package>`
**What it does:** downloads a package and adds it to `"dependencies"` (needed at runtime).
**Example:** `npm install @nestjs/jwt`.

### `npm install -D <package>`
**What it does:** same, but adds it to `"devDependencies"` (only needed while developing).
**Example:** `npm install -D @types/jest`.

---

## 7. Testing the health endpoint

### `curl http://localhost:3000/api/health`
**What it does:** sends a GET request to your health route and prints the response in the terminal. A working endpoint returns the JSON body and HTTP status 200.
**When to use it:** to confirm the server is up and `/api/health` works — this is how you validate task 1.2.
**Tip:** add `-i` (`curl -i http://localhost:3000/api/health`) to also see the status line and headers, so you can confirm the `200`.

## Resources

### Documentation
- [Docker Documentation](https://docs.docker.com)
- [React Documentation](https://react.dev)
- [MariaDB Documentation](https://mariadb.com/kb/en/documentation)
- [ModSecurity Reference Manual](https://github.com/SpiderLabs/ModSecurity/wiki)
- [HashiCorp Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [OWASP CRS Documentation](https://coreruleset.org/docs)
- [OWASP Top 10](https://owasp.org/www-project-top-ten)

### Security Standards & Password Policy

| Standard | Organization | Topic | URL |
|----------|-------------|-------|-----|
| SP 800-63B | NIST | Digital Identity Guidelines — Password Policy | https://pages.nist.gov/800-63-3/sp800-63b.html |
| Authentication Cheat Sheet | OWASP | Secure Authentication Implementation | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| Password Storage Cheat Sheet | OWASP | bcrypt, Argon2, password hashing | https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html |

#### Password Policy Applied in This Project (based on NIST SP 800-63B + OWASP)

| Rule | Value | Reference |
|------|-------|-----------|
| Minimum length | 8 characters | NIST SP 800-63B |
| Maximum length | 128 characters | OWASP |
| Complexity requirement | Not enforced | NIST SP 800-63B |
| Hashing algorithm | bcrypt | OWASP Password Storage |
| bcrypt cost factor | 12 (~300ms) | OWASP recommendation |
| Failed attempt limit | 5 attempts → 30s delay | OWASP |
| Allowed characters | All Unicode | OWASP |

### AI Usage
- **Tool used**: Claude (Anthropic), Gemini
- **Tasks assisted**:
  - Docker network architecture design
  - Privacy Policy and Terms of Service drafting
  - README structure and content
- **Note**: All AI-generated content was reviewed, tested, and validated by the team before use.
