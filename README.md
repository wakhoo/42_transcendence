*This project has been created as part of the 42 curriculum by aboutale, asdiallo, chajeon, dancel, elxhafer.*

---

# ft_transcendence

> A web-based gaming platform with real-time multiplayer, secure authentication, and social features.

---

## Description

**ft_transcendence** is a web project built as the final project of the 42 Common Core.

### Key Features
- [Feature 1]
- [Feature 2]
- [Feature 3]
- [Feature 4]

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
https://dancel.42.fr
# or
https://localhost
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

# Backend — Next.js
BACKEND_PORT=3000
NEXTAUTH_URL=https://dancel.42.fr
NEXTAUTH_SECRET=

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

## Team Information

| Member | Role | Responsibilities |
|--------|------|-----------------|
| dancel | Product Owner + Developer | Product vision, backlog, game part |
| chajeon | Project Manager + Developer | Team coordination, security, Docker infrastructure, WAF, 2FA |
| asdiallo | Tech Lead + Developer | Architecture, backend (Next.js), database design |
| aboutale | Developer | Backend - game |
| elxhafer | Developer | Frontend (React) |

---

## Project Management

### Work Organization
- Tasks divided by module and role
- Weekly sync meetings every [day] at [time]
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
| Next.js | Full-stack framework, API routes, SSR support |
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
| Backend API | Next.js API routes | asdiallo |
| Database Design | MariaDB schema and relations | asdiallo |
| Frontend UI | React components and pages | elxhafer |
| [Game Feature] | [Description] | dancel |
| [Game Backend] | [Description] | aboutale |
| Privacy Policy Page | Accessible from footer | chajeon |
| Terms of Service Page | Accessible from footer | chajeon |

---

## Modules

### Chosen Modules

| Module | Category | Type | Points | Developer(s) |
|--------|----------|------|--------|--------------|
| Full-Stack Framework (Next.js + React) | Web | Major | 2 | asdiallo, elxhafer |
| [WebSocket Real-Time] | Web | Major | 2 | [login] |
| [User Interaction] | Web | Major | 2 | [login] |
| Standard User Management | User Management | Major | 2 | chajeon, asdiallo |
| WAF/ModSecurity + HashiCorp Vault | Cybersecurity | Major | 2 | chajeon |
| [Web-Based Game] | Gaming & UX | Major | 2 | dancel |
| [Remote Players] | Gaming & UX | Major | 2 | dancel |
| 2FA | User Management | Minor | 1 | chajeon |
| OAuth 2.0 | User Management | Minor | 1 | chajeon |
| [Tournament System] | Gaming & UX | Minor | 1 | dancel |
| **Total** | | | **TBD** | |

### Point Calculation
- Major modules (2pt each): [N] × 2 = [N]pt
- Minor modules (1pt each): [N] × 1 = [N]pt
- **Total: [N]pt** (minimum required: 14pt)

---

## Individual Contributions

### dancel — Product Owner + Developer
- Product vision and backlog management
- Game module implementation
- [Feature or module implemented]
- Challenges: [Any challenges faced and how resolved]

### chajeon — Project Manager + Developer
- Team coordination, meeting facilitation, progress tracking
- Docker infrastructure (4-network isolation, docker-compose, Makefile)
- Nginx configuration and TLS 1.3 setup
- WAF/ModSecurity + HashiCorp Vault module
- HTTPS configuration and security headers
- 2FA (TOTP) implementation
- OAuth 2.0 authentication
- Privacy Policy and Terms of Service pages
- Challenges: [Any challenges faced and how resolved]

### asdiallo — Tech Lead + Developer
- Overall architecture design
- Technology stack decisions
- Backend development (Next.js API routes)
- Database schema design (MariaDB)
- [Feature or module implemented]
- Challenges: [Any challenges faced and how resolved]

### aboutale — Developer
- Backend development (Game)
- [Feature or module implemented]
- Challenges: [Any challenges faced and how resolved]

### elxhafer — Developer
- Frontend development (React)
- UI components and pages
- [Feature or module implemented]
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
- [Next.js Documentation](https://nextjs.org/docs)
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
