*This project has been created as part of the 42 curriculum by aboutale, asdiallo, chajeon, dancel.*

---

# ft_transcendence

> A web-based gaming platform with real-time multiplayer, secure authentication, and social features.

---

## Description

**ft_transcendence** is a web project built as the final project of the 42 Common Core.

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

### Container overview

| Container | Built from | External port | Role |
|-----------|-----------|---------------|------|
| `nginx` | `srcs/nginx/` | 8443 (HTTPS), 8080 (HTTP → redirects to 8443) | Reverse proxy + WAF — only entry point |
| `frontend` | `srcs/frontend/` | none | React/Vite UI |
| `backend` | `srcs/backend/` | none | NestJS REST API |
| `mariadb` | `srcs/mariadb/` | none | Relational database |

### What each container does

**`nginx`** — The only container reachable from the internet. Every request passes through it. It routes `/api/*` to the backend, `/ws` to the websocket server, and everything else to the frontend. ModSecurity runs as a Web Application Firewall to block SQLi, XSS, and other OWASP Top 10 attacks before they reach the app.

**`frontend`** — Serves the React application compiled by Vite. Not exposed directly — nginx proxies requests to it on the internal Docker network.

**`backend`** — The NestJS API. Handles all business logic, exposes routes under `/api`, and manages WebSocket connections via integrated NestJS gateways (`/ws`). Talks to `mariadb` for data persistence. Not exposed externally — nginx forwards matching requests to it.

**`mariadb`** — Stores all persistent data. Accessible only from the `backend` container through the isolated `db` network. Data survives container restarts via the `mariadb_data` Docker volume.

### Network isolation

Four Docker networks enforce strict separation between layers:

| Network | Members | Purpose |
|---------|---------|---------|
| `dmz` | nginx | Faces the internet |
| `internal` | nginx, frontend, backend | Internal app traffic |
| `db` | backend, mariadb | Database access only |
| `vault_net` | backend, vault (planned) | Secrets management |

A container can only reach another container if they share a network. `mariadb` is on `db` only — the frontend can never reach the database, even accidentally.

### Healthchecks

Each container declares a healthcheck so Docker knows when it is truly ready:

| Container | Check | What it verifies |
|-----------|-------|-----------------|
| `nginx` | `nginx -t` | Config is valid and process is running |
| `frontend` | `curl http://localhost:3000` | UI server responds |
| `backend` | `curl http://localhost:3000/api/health` | NestJS API responds |
| `mariadb` | `mariadb-admin ping` | Database accepts connections |

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
| HashiCorp Vault | Secret and credential management (planned) |

---

## Database Schema

### Tables

#### users
| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| email | VARCHAR | Unique, used for login |
| password_hash | VARCHAR | bcrypt hashed password (nullable for OAuth users) |
| username | VARCHAR | Display name |
| avatar_url | VARCHAR | Profile picture URL |
| profile_color | VARCHAR | UI accent color |
| totp_secret | VARCHAR | 2FA seed (nullable) |
| totp_enabled | BOOLEAN | 2FA toggle |
| created_at | TIMESTAMP | Account creation date |

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

### Relationships
- users 1 — N channel_members — N channels (join table)
- users 1 — N messages (as sender)
- users 1 — N friendships (as requester or addressee)
- users 1 — N audit_logs (by user_id, no FK constraint — see above)
- channels 1 — N messages
- channels 1 — N channel_members

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
| Public API | Secured REST API with rate limiting | chajeon |
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
| Public API | Web | Major | 2 | chajeon | — |
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
| **Total** | | | **27** | | |

### Point Calculation
- Major modules (2pt each): 9 × 2 = 18pt
- Minor modules (1pt each): 9 × 1 = 9pt
- **Total: 27pt** (minimum required: 14pt)

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
- Team coordination, meeting facilitation, progress tracking
- Docker infrastructure (4-network isolation, docker-compose, Makefile)
- Nginx configuration and TLS 1.3 setup
- Email + Password Authentication with bcrypt (mandatory)
- HTTPS configuration and security headers (mandatory)
- Privacy Policy and Terms of Service pages (mandatory)
- README.md (mandatory)
- OAuth 2.0 Authentication (Minor)
- 2FA / TOTP implementation (Minor)
- WAF/ModSecurity + HashiCorp Vault module (Major)
- GDPR Compliance (Minor)
- Challenges: [Any challenges faced and how resolved]

### asdiallo — Tech Lead + Developer
- Overall architecture design
- Technology stack decisions
- Web Application scaffold: frontend + backend + DB (mandatory)
- Docker Single-Command Deployment (mandatory)
- Responsive Frontend (mandatory)
- Input Validation, frontend + backend (mandatory)
- Full-Stack Framework Usage (Major)
- Frontend Framework Only (Minor)
- Backend Framework Only (Minor)
- Standard User Management & Auth (Major)
- Challenges: [Any challenges faced and how resolved]

### aboutale — Developer
- Web-Based Game (Major)
- Remote Players (Major)
- Multiplayer, 3+ Players (Major)
- Spectator Mode (Minor)

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



## Team Information (aboutale)
[aboutale]

Role: Full-Stack Developer (Game Engine & UI)

Responsibilities: Architecting the core backend game loop (NestJS Gateways/Services), implementing the interactive frontend Canvas, managing real-time WebSocket state synchronization, and building the responsive Dashboard UI.

Features List (Features you worked on)
Core Game Engine (Backend): Real-time drawing synchronization, automated turn management, word selection, timeout events, and dynamic scoring system.

Interactive Canvas (Frontend): High-performance real-time drawing interface with stroke transmission and rendering. 

Real-Time Dashboard Synchronization: Live updates of active game rooms, player presence, and room states.





------------------------------------------------------------------------------------------------------------------------






### Individual Contributions 

Backend Game Architecture: Developed game.gateway.ts and game.service.ts. Managed complex game states, including turn rotation, timer events, hint generation, and graceful handling of unexpected player disconnections (e.g., transferring admin rights, auto-canceling empty games).

Frontend Game Mechanics: Built the HTML5 Canvas integration to accurately capture, scale, and broadcast drawing coordinates in real-time across all connected clients.

Dashboard & Chat Integration: Connected the UI to backend WebSocket events (channel_deleted, presenceChanged) to ensure the frontend strictly mirrors the database state. Built the responsive layout and profile modals using Tailwind CSS.

Frontend Anti-Crash System: Implemented strict data validation (Array.isArray()) to protect React from crashing when receiving HTTP 429 (Too Many Requests) errors instead of expected data arrays during high server load.

### Challenges Faced & Solutions Overcome:

Challenge: "Ghost Timers" and Race Conditions in Game Logic. When a player was kicked or disconnected at the exact millisecond a round timer ended, the server would trigger setTimeout callbacks for a canceled game, sending empty hints or crashing the round.

Solution: Implemented strict state checks before executing delayed functions and ensured all active timeouts were cleared when a room became empty or a game was forced to close.

Challenge: Canvas Synchronization & Performance. Broadcasting every single pixel movement over WebSockets caused network congestion and lag.

Solution: Optimized the frontend Canvas logic to batch coordinate events and emit drawing strokes efficiently, ensuring smooth rendering for all clients.

Challenge: "White Screen of Death" (React Crashes) during UI spam. Rapid interactions triggered backend Throttler rate limits, replacing JSON arrays with error objects on the frontend, breaking .map() functions.

Solution: Added strict array type-checking before updating React states, allowing the UI to safely ignore error payloads and freeze gracefully until the rate limit expired.