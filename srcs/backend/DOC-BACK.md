# doc-back.md — Backend architecture

A reference describing how the NestJS backend is organized: the config files that set up the project, the source folders that hold the business logic, the dependencies each feature relies on, and why the whole thing runs inside a Docker container.

## Config files

### `nest-cli.json`
This is the configuration of the `nest` command-line tool — the one behind `nest start` and `nest build`. It tells `nest` where to find the source code and how to build it.

### `package.json`
This is the identity card of the Node project. It states two essential things: what the code needs in order to run (the dependencies), and which commands exist (the scripts). Without it, `npm install` doesn't know what to install, and `npm run start:dev` doesn't exist.

### `tsconfig.json`
The `tsconfig` is the bridge between TypeScript and the JavaScript that Node executes. Node doesn't understand TypeScript directly, so this file tells the compiler how to translate the code and which typing rules to apply.

### `Dockerfile`
Builds the backend into a Docker image using a **multi-stage build**:
1. **`builder` stage** — installs *all* dependencies (`npm ci`), copies the source, and runs `npm run build` to compile TypeScript into `dist/`.
2. **Final stage** — starts from a clean `node:20-alpine` image, installs only production dependencies (`npm ci --omit=dev`), and copies just the compiled `dist/` folder from the builder stage.

The point of splitting it in two stages: the final image never contains TypeScript source, dev dependencies, or build tools — only the compiled JS and what it needs to run. Smaller image, smaller attack surface. See [Why containerize the backend](#why-containerize-the-backend) below for the full reasoning.

## Source files

### `main.ts`
This is the entry point — the very first file that runs. Its job: start the HTTP server. Everything flows out of it.

### `app.module.ts`
This is the root module, the assembly point. It wires together all the pieces of the app. NestJS organizes code into modules: boxes that group together things that belong together. The root module declares the controllers and imports the sub-modules.

### `health.controller.ts`
The controller is the mapping table between incoming requests and the code. Without it, the server runs but doesn't know how to answer anything. It declares all the routes of the class, tells the method right below it to respond to GET requests on the given path, and runs it.

## `src/` — where the actual logic lives

`app.module.ts` wires together everything under `src/`, but it doesn't contain business logic itself — it just assembles the folders below. Each folder is a self-contained NestJS module: it owns its own database entities, its own routes, and its own rules. This doc stays at folder level; `AUTH.md` already goes file-by-file for auth if that level of detail is needed.

| Folder | What it's responsible for |
|---|---|
| `auth/` | Everything about *proving who you are*: register, login, JWT issuance, Google OAuth, 2FA. Fully documented in `AUTH.md`. |
| `user/` | Everything about *the user record itself*: reading and writing rows in the `users` table (email, username, avatar, TOTP flags…). `auth/` calls into this module, it doesn't touch the database directly. |
| `chat/` | Where real-time messaging between players will live (entities, guards, decorators are already scaffolded). Not yet wired into `app.module.ts` — see the commented-out `ChatModule` import. |
| `health/` | The `/api/health` endpoint used by Docker's healthcheck. No business value beyond "is the server alive". |

Game logic isn't implemented yet — when it lands, it will follow the same pattern: its own folder, its own module, imported into `app.module.ts`.

This is the layer the frontend actually talks to: every screen that shows game state, chat messages, or user profile info (username, avatar, 2FA status…) gets that data by calling a route exposed by one of these modules over `/api/*`.

### Request flow (schema)

Two separate paths exist, for two different needs. Use the **REST API** (`backend`) when the frontend asks a one-off question and expects one answer: log in, fetch a profile, enable 2FA. Use the **WebSocket** (`websocket`) when data needs to flow continuously without either side asking for it: chat messages, live paddle/ball coordinates, score updates.

The browser only ever talks to `nginx` (port 443). `nginx` decides which container to forward to by looking at the URL path — nothing more:

```nginx
location /api/  { proxy_pass http://backend:3000; }
location /ws    { proxy_pass http://websocket:9000; }
location /      { proxy_pass http://frontend:3000; }  # everything else
```

**Path 1 — REST API (`/api/...`): request → one response, connection closes**

```
Browser  ──fetch('/api/...')──▶  nginx  ──▶  backend (NestJS)  ──▶  mariadb
                                                   │
                                    Controller → Guard → Service → Repository
```

What each box inside `backend` does, in order:
- **Controller** — receives the request, checks the body shape against the DTO (`login.dto.ts`…).
- **Guard** — reads the `Authorization` header and rejects the request early if the token is missing/invalid (skipped for public routes like login).
- **Service** — the actual business logic: `bcrypt.compare()`, sign the JWT, check the TOTP code…
- **Repository** — TypeORM's object for talking to the DB (`this.repo.findOne(...)`, `.save(...)`). It's the last step before the real SQL query hits `mariadb`.

Example: `POST /api/auth/login` — the browser sends email+password, the backend checks the DB, replies once with a token, done.

**Path 2 — WebSocket (`/ws`): one connection stays open, messages flow both ways**

```
Browser  ──WebSocket upgrade '/ws'──▶  nginx  ──▶  websocket (ws server)
   ▲                                                       │
   └───────────────── messages pushed anytime ─────────────┘
```

Example: during a match, paddle position updates and chat messages get pushed the instant they happen — no repeated `fetch()` calls, no waiting for a request.

### `websocket/` — real-time server

A separate, minimal Node process — **not** NestJS, no REST routes, no database access of its own. It uses the raw [`ws`](https://github.com/websockets/ws) library instead of Socket.IO. Its job is anything that can't wait for a request/response round trip:

- **Chat** — messages typed by one player need to reach the other player(s) immediately.
- **Live game state** — paddle position, ball coordinates, score updates: dozens of tiny updates per second, far too chatty for REST.

How it works today (`srcs/websocket/server.js`): it opens a plain HTTP server on port 9000 with two things attached —
1. a `GET /health` route (used only by Docker's healthcheck, see the table below),
2. a `WebSocketServer` that accepts the upgrade, logs incoming messages, and logs disconnects.

There's no chat or game logic wired in yet — right now it just proves the connection works. When that logic lands, it will live here: broadcasting each client's message to the other player(s) in the same room/match instead of just logging it.

Why it's its own container instead of living inside the NestJS `backend`:
- A WebSocket connection is **long-lived** (stays open for the whole match/chat session) while HTTP requests are short-lived — mixing the two workloads in one process makes the REST API's restart/scaling story messier.
- nginx proxies `/ws` straight to it (`proxy_pass http://websocket:9000` with the `Upgrade`/`Connection` headers set for the protocol switch — see `nginx.conf`), completely separate from the `/api/*` routing to `backend`.
- It sits on the `internal` network only, **not** on `db` — it cannot query MariaDB directly today. If chat history ever needs to be persisted, it will have to go through the `backend`'s API (or be added to the `db` network later) rather than talking to the database itself.

## Backend `package.json` scripts — explained

Each entry in the `"scripts"` block of `package.json` gives a short name to a real terminal command.
You run them with `npm run <name>` (for example `npm run start:dev`).

---

### `"build": "nest build"`
Runs the NestJS build. It compiles all the TypeScript in `src/` into plain JavaScript and writes the result into a `dist/` folder. The browser and Node only understand JavaScript, so this step turns your source code into something runnable in production.

### `"start": "nest start"`
Starts the backend server **once**. It compiles and launches the app, but it does **not** watch for file changes — if you edit your code, you must stop and restart it yourself. Mostly used for a quick single run.

### `"start:dev": "nest start --watch"`
Starts the server in **watch mode**. The `--watch` flag tells NestJS to keep an eye on your files and automatically recompile and restart the server every time you save. This is the command used while actively developing, because changes appear instantly without a manual restart. It is also the command that validates task 1.2 (`npm run start:dev` must serve `/api/health`).

### `"start:prod": "node dist/main"`
Runs the **already-compiled** application directly with Node. It executes `dist/main.js`, the JavaScript produced by `npm run build`. It does not compile anything itself, so `build` must have been run first. This is the lightweight command typically used inside the Docker container in production.

### `"lint": "eslint \"src/**/*.ts\" --fix"`
Runs ESLint on every `.ts` file inside `src/`. ESLint analyzes the code to find mistakes and bad practices (unused variables, unsafe patterns, style issues). The `--fix` flag tells it to automatically correct everything it safely can. Run before committing to keep the codebase clean.

### `"format": "prettier --write \"src/**/*.ts\""`
Runs Prettier on every `.ts` file inside `src/`. Prettier rewrites the files to follow one consistent style (quotes, indentation, spacing, commas). The `--write` flag means "actually modify the files" — without it, Prettier would only report what is wrong. Run before committing so the whole team's code looks the same.

---

## Quick reference

| Script | Command behind it | Purpose |
| --- | --- | --- |
| `build` | `nest build` | Compile TypeScript → JavaScript in `dist/` |
| `start` | `nest start` | Run the server once (no auto-reload) |
| `start:dev` | `nest start --watch` | Run with auto-reload (main dev command) |
| `start:prod` | `node dist/main` | Run the compiled app (production / Docker) |
| `lint` | `eslint "src/**/*.ts" --fix` | Find and auto-fix code problems |
| `format` | `prettier --write "src/**/*.ts"` | Auto-format code to a consistent style |

---

## Dependencies — what each one is for and why it's there

`package.json` lists the packages the backend actually needs. Grouped by what they do:

| Package | Role |
|---|---|
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | The NestJS framework itself — modules, controllers, decorators, the HTTP server underneath (Express). |
| `@nestjs/config` | Loads `.env` variables and exposes them via `ConfigService` (used for `MARIADB_*`, `JWT_SECRET`, etc.). |
| `@nestjs/typeorm`, `typeorm`, `mysql2` | Database layer. TypeORM is the ORM (maps TS classes like `User` to SQL tables); `mysql2` is the actual driver that talks to MariaDB over the wire. |
| `@nestjs/jwt` | Signs and verifies the JWT access/partial tokens described in `AUTH.md`. |
| `bcrypt` | One-way password hashing (cost factor 12) — never store plaintext passwords. |
| `@nestjs/passport`, `passport`, `passport-google-oauth20` | Google OAuth 2.0 login flow (`GoogleStrategy`). |
| `otplib`, `qrcode` | 2FA: `otplib` generates/verifies TOTP codes, `qrcode` turns the secret into a scannable QR code image. |
| `class-validator`, `class-transformer` | Validate and shape incoming request bodies against the DTOs (e.g. reject a `register` request with a 3-character password before it ever reaches the service). |
| `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` | Real-time transport for chat/game features once `ChatModule` (and later game) is wired in. |
| `reflect-metadata`, `rxjs` | Low-level dependencies NestJS itself needs (decorator metadata, reactive streams) — not called directly in app code. |

Dev-only tools (`eslint`, `prettier`'s peers, `@nestjs/cli`, `typescript`, `@types/*`) never ship in the production image — see the Dockerfile's `builder` stage below.

---

## Docker — Containers and how to run them

### Why containerize the backend

- **Reproducibility** — "works on my machine" stops being a problem: the image bundles the exact Node version and exact dependency versions, so it behaves the same in dev, CI, and prod.
- **Isolation** — the backend process can't see or touch the host filesystem beyond what's explicitly mounted, and it can't reach anything outside the Docker networks it's attached to.
- **Network segmentation as a security boundary** — the backend is the *only* app container plugged into the `db` network. Nothing else, not even the frontend, can open a connection to MariaDB. If the frontend or nginx were compromised, the attacker still couldn't reach the database directly.
- **Independent scaling/restarts** — `docker compose` can restart or rebuild the backend without touching the frontend, database, or nginx, and the healthcheck (`curl /api/health`) stops traffic from being routed to it before it's actually ready.

### How to start the full stack

```bash
docker compose up --build
```

Run this from the `srcs/` directory (where `docker-compose.yml` lives).

- `up` starts all the containers defined in `docker-compose.yml`
- `--build` forces Docker to rebuild every image from scratch before starting — use it when you changed a `Dockerfile` or added/removed dependencies

To stop everything:
```bash
docker compose down
```

To stop and wipe the volumes (database included):
```bash
docker compose down -v
```

---

### Container overview

| Container | Image built from | Exposed port | Role |
|-----------|-----------------|--------------|------|
| `nginx` | `./nginx/` | 443 (HTTPS), 80 (HTTP) | Reverse proxy + WAF |
| `frontend` | `./frontend/` | none (internal only) | React/Vite UI |
| `backend` | `./backend/` | none (internal only) | NestJS API |
| `websocket` | `./websocket/` | none (internal only) | Real-time server |
| `mariadb` | `./mariadb/` | none (internal only) | Database |

---

### Container details

#### `nginx` — Reverse proxy / WAF
The only container that accepts traffic from the outside world. It receives every HTTP and HTTPS request and routes them to the right internal container. It also runs ModSecurity as a Web Application Firewall (WAF) to block common attacks (SQLi, XSS…). Nothing reaches the backend or the frontend without going through it first.

#### `frontend` — React/Vite UI
Serves the React application. It is not exposed directly to the internet — nginx proxies requests to it on the internal Docker network. In production mode the Vite build outputs static files that are served by a small HTTP server.

#### `backend` — NestJS API
The business logic of the application. It exposes a REST API under `/api` on port 3000 **inside** the Docker network. Nginx forwards `/api/*` requests to it. It connects to `mariadb` for data and to `vault` (when enabled) for secrets.

#### `websocket` — Real-time server
Handles WebSocket connections for features that need live updates (game state, chat…). Runs on port 9000 inside the Docker network. Nginx proxies WebSocket upgrade requests to it. See [`websocket/` — real-time server](#websocket--real-time-server) above for how it actually works.

#### `mariadb` — Database
Stores all persistent data. It is only reachable from the `backend` container via the `db` network — no other container can talk to it directly, and it has no port exposed to the host. The data is persisted in the `mariadb_data` Docker volume so it survives container restarts.

---

### Network isolation

The stack uses four separate Docker networks to enforce strict isolation:

| Network | Who is on it | Why |
|---------|-------------|-----|
| `dmz` | nginx | Faces the internet |
| `internal` | nginx, frontend, backend, websocket | Internal app traffic |
| `db` | backend, mariadb | Database access only |
| `vault_net` | backend (+ vault when enabled) | Secrets management |

A container can only reach another container if they share a network. `mariadb` is on `db` only — the frontend can never reach it directly, even by accident.

---

### Healthchecks

Each container declares a healthcheck so Docker knows when it is truly ready (not just started):

| Container | Healthcheck command | What it verifies |
|-----------|-------------------|-----------------|
| `nginx` | `nginx -t` | Nginx config is valid and the process is running |
| `frontend` | `curl http://localhost:3000` | The frontend server responds |
| `backend` | `curl http://localhost:3000/api/health` | The NestJS API responds (via `HealthController`) |
| `websocket` | `curl http://localhost:9000/health` | The WebSocket server responds |
| `mariadb` | `mariadb-admin ping` | The database accepts connections |

`backend` waits for `mariadb` to be healthy before starting. This prevents NestJS from crashing on startup because the database is not ready yet.

---

## eslint.config.mjs — what it is and why it matters

## What ESLint is
ESLint is a **linter**: a tool that reads your code and flags problems — bugs (unused variables, unsafe patterns), and style inconsistencies. It runs through the `npm run lint` script.

## What this file does
`eslint.config.mjs` is **ESLint's configuration file**. It tells ESLint *which files to check* and *which rules to apply*. Without it, ESLint wouldn't know how to analyze a TypeScript NestJS project.

The `.mjs` extension forces the file to use modern `import` syntax.

## The "flat config" format
Since ESLint 9, configuration uses the **flat config** format: the file exports an array of configuration objects. Instead of listing rule sets as text strings (the old `extends: [...]` style), you **import** what you need and add it to the list. It is more explicit — you can see exactly what is being used.

## Why it is useful in the project
- It catches mistakes early, before they become runtime bugs.
- It enforces one consistent code style across the whole team, so everyone's code looks the same.
- It is required by task 1.2 ("configure TS + ESLint + Prettier") and powers the `npm run lint` command.