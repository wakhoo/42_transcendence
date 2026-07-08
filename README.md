*This project has been created as part of the 42 curriculum by aboutale, asdiallo, chajeon, dancel.*

---

# ft_transcendence

> A web-based gaming platform with real-time multiplayer, secure authentication, and social features.

---

## Description

**ft_transcendence** is a web project built as the final project of the 42 Common Core.

### Key Features
- Real-time drawing & guessing game: one player gets a keyword and draws it, others guess in the chat
- Multiplayer support with remote players (3+) and live reconnection
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
https://dancel.42.fr:8443
# or
https://localhost:8443
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database — MariaDB
DB_HOST=mariadb
DB_PORT=3306
DB_ROOT_PASSWORD=
DB_USER=
DB_PASSWORD=
DB_NAME=ft_transcendence

# Backend — Nest.js
BACKEND_PORT=3000
NESTAUTH_URL=https://dancel.42.fr
NESTAUTH_SECRET=

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=3600

# Frontend — React
VITE_API_URL=https://dancel.42.fr/api
VITE_WS_URL=wss://dancel.42.fr/ws

# WebSocket
WS_PORT=9000

# OAuth — Google
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=

# OAuth — GitHub
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=

# 2FA
TOTP_ISSUER=ft_transcendence
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
| `websocket` | `srcs/websocket/` | none | Real-time WebSocket server |
| `mariadb` | `srcs/mariadb/` | none | Relational database |

### What each container does

**`nginx`** — The only container reachable from the internet. Every request passes through it. It routes `/api/*` to the backend, `/ws` to the websocket server, and everything else to the frontend. ModSecurity runs as a Web Application Firewall to block SQLi, XSS, and other OWASP Top 10 attacks before they reach the app.

**`frontend`** — Serves the React application compiled by Vite. Not exposed directly — nginx proxies requests to it on the internal Docker network.

**`backend`** — The NestJS API. Handles all business logic and exposes routes under `/api`. Talks to `mariadb` for data persistence. Not exposed externally — nginx forwards matching requests to it.

**`websocket`** — Manages WebSocket connections for real-time features (game state, live updates). Listens on port 9000 inside the Docker network. Nginx handles the WebSocket upgrade and proxies connections to it.

**`mariadb`** — Stores all persistent data. Accessible only from the `backend` container through the isolated `db` network. Data survives container restarts via the `mariadb_data` Docker volume.

### Network isolation

Four Docker networks enforce strict separation between layers:

| Network | Members | Purpose |
|---------|---------|---------|
| `dmz` | nginx | Faces the internet |
| `internal` | nginx, frontend, backend, websocket | Internal app traffic |
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
| `websocket` | `curl http://localhost:9000/health` | WebSocket server responds |
| `mariadb` | `mariadb-admin ping` | Database accepts connections |

`backend` waits for `mariadb` to report healthy before starting, preventing startup crashes when the database is not yet ready.

---

## Team Information

| Member | Role | Responsibilities |
|--------|------|-----------------|
| dancel | Product Owner + Developer | Product vision, backlog; WebSocket real-time, chat/profile/friends, Public API, ORM, Content Moderation AI, Web-Based Game, Remote Players, Multiplayer (3+), Advanced Chat, Microservices Architecture |
| chajeon | Project Manager + Developer | Team coordination; auth (bcrypt), HTTPS, Privacy Policy/ToS, README, OAuth 2.0, 2FA, WAF/ModSecurity + Vault, GDPR Compliance |
| asdiallo | Tech Lead + Developer | Architecture; web app scaffold, Docker single-command deployment, responsive frontend, input validation, full-stack framework usage, frontend/backend framework, Standard User Management & Auth |
| aboutale | Developer | Game Statistics & Match History, Tournament System, Game Customization, Gamification System, Spectator Mode |

---

## Project Management

### Work Organization
- Tasks divided by module and role
- Weekly sync meetings
- Task tracking via Google Sheet

### Tools Used
- **Issue Tracker**: Google Sheet
- **Communication**: Slack
- **Version Control**: Git — [repository URL]

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
| [Tailwind / Bootstrap] | [Why this CSS framework] |

### Backend
| Technology | Reason |
|-----------|--------|
| Nest.js | Full-stack framework, API routes, SSR support |
| [Prisma / TypeORM] | [Why this ORM] |

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
| id | UUID | Primary key |
| email | VARCHAR | Unique, used for login |
| password_hash | VARCHAR | bcrypt hashed password |
| username | VARCHAR | Display name |
| avatar_url | VARCHAR | Profile picture |
| totp_secret | VARCHAR | 2FA seed (nullable) |
| is_2fa_enabled | BOOLEAN | 2FA toggle |
| created_at | TIMESTAMP | Account creation date |

#### [table2]
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| [column] | [type] | [description] |

### Relationships
- [users] 1 — N [table2]
- [Describe other relationships]

---

## Features List

| Feature | Description | Developer(s) |
|---------|-------------|--------------|
| User Registration & Login | Email + password auth with bcrypt | chajeon |
| HTTPS / TLS 1.3 | All connections encrypted | chajeon |
| Docker Infrastructure | 4-network isolation, single-command run | chajeon |
| WAF / ModSecurity | OWASP CRS, SQLi/XSS protection | chajeon |
| 2FA Authentication | TOTP-based with QR code registration | chajeon |
| Backend API | Nest.js API routes | asdiallo |
| Database Design | MariaDB schema and relations | asdiallo |
| Drawing & Guessing Game | One player gets a keyword and draws it live; others guess in real-time chat | dancel, aboutale |
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
| Public API | Web | Major | 2 | dancel | — |
| Standard User Management & Auth | User Management | Major | 2 | asdiallo | — |
| WAF/ModSecurity + HashiCorp Vault | Cybersecurity | Major | 2 | chajeon | — |
| Web-Based Game | Gaming & UX | Major | 2 | dancel | — |
| Remote Players | Gaming & UX | Major | 2 | dancel | Requires a game module |
| Multiplayer (3+ Players) | Gaming & UX | Major | 2 | dancel | Requires a game module |
| Microservices Architecture | DevOps | Major | 2 | dancel | — |
| Frontend Framework Only | Web | Minor | 1 | asdiallo | — |
| Backend Framework Only | Web | Minor | 1 | asdiallo | — |
| ORM | Web | Minor | 1 | dancel | — |
| Game Statistics & Match History | User Management | Minor | 1 | aboutale | Requires a game module |
| OAuth 2.0 Authentication | User Management | Minor | 1 | chajeon | — |
| 2FA (Two-Factor Authentication) | User Management | Minor | 1 | chajeon | — |
| Content Moderation AI | Artificial Intelligence | Minor | 1 | dancel | — |
| Advanced Chat Features | Gaming & UX | Minor | 1 | dancel | Requires User Interaction module |
| Tournament System | Gaming & UX | Minor | 1 | aboutale | Requires a game module |
| Game Customization | Gaming & UX | Minor | 1 | aboutale | Requires a game module |
| Gamification System | Gaming & UX | Minor | 1 | aboutale | — |
| Spectator Mode | Gaming & UX | Minor | 1 | aboutale | Requires a game module |
| GDPR Compliance | Data & Analytics | Minor | 1 | chajeon | — |
| **Total** | | | **33** | | |

### Point Calculation
- Major modules (2pt each): 10 × 2 = 20pt
- Minor modules (1pt each): 13 × 1 = 13pt
- **Total: 33pt** (minimum required: 14pt)

---

## Individual Contributions

### dancel — Product Owner + Developer
- Product vision and backlog management
- Multi-User Simultaneous Support (mandatory)
- WebSocket Real-Time Features (Major)
- User Interaction: Chat + Profile + Friends (Major)
- Public API (Major)
- ORM (Minor)
- Content Moderation AI (Minor)
- Web-Based Game (Major)
- Remote Players (Major)
- Multiplayer, 3+ Players (Major)
- Advanced Chat Features (Minor)
- Microservices Architecture (Major)
- Challenges: [Any challenges faced and how resolved]

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
- Game Statistics & Match History (Minor)
- Tournament System (Minor)
- Game Customization (Minor)
- Gamification System (Minor)
- Spectator Mode (Minor)
- Challenges: [Any challenges faced and how resolved]

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
- **Tool used**: Claude (Anthropic)
- **Tasks assisted**:
  - Docker network architecture design
  - Privacy Policy and Terms of Service drafting
  - README structure and content
- **Note**: All AI-generated content was reviewed, tested, and validated by the team before use.
