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
| `user/` | Everything about *the user record itself*: reading and writing rows in the `users` table (email, username, avatar, TOTP flags…), plus the GDPR data-rights endpoints. `auth/` calls into this module, it doesn't touch the database directly. |
| `chat/` | Real-time messaging: `ChatGateway` (Socket.IO, `/chat` namespace), channels, DMs, friends, block/unblock, moderation. Wired into `app.module.ts`. |
| `game/` | The drawing/guessing game: `GameGateway` (Socket.IO, `/game` namespace) and `GameService`. See `../../game.md` for the full event flow. Wired into `app.module.ts`. |
| `mail/` | `MailService` — sends the GDPR confirmation emails (profile changed / data exported / account deleted). |
| `health/` | The `/api/health` endpoint used by Docker's healthcheck. No business value beyond "is the server alive". |

This is the layer the frontend actually talks to: every screen that shows game state, chat messages, or user profile info (username, avatar, 2FA status…) gets that data by calling a route exposed by one of these modules over `/api/*`.

### Request flow (schema)

Two separate paths exist, for two different needs. Use the **REST API** when the frontend asks a one-off question and expects one answer: log in, fetch a profile, enable 2FA. Use **WebSocket (Socket.IO)** when data needs to flow continuously without either side asking for it: chat messages, drawing strokes, round/timer updates, presence.

Both live inside the same `backend` NestJS process — there is no separate real-time service. REST controllers and the two `@WebSocketGateway()` classes (`ChatGateway` on the `/chat` namespace, `GameGateway` on the `/game` namespace) are just different entry points into the same app, sharing the same services and the same MariaDB connection.

The browser only ever talks to `nginx` (port 443). `nginx` decides which container to forward to by looking at the URL path — nothing more:

```nginx
location /api/       { proxy_pass http://backend:3000; }
location /socket.io  { proxy_pass http://backend:3000; }  # Socket.IO upgrade, still `backend`
location /            { proxy_pass http://frontend:3000; }  # everything else
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

**Path 2 — WebSocket / Socket.IO (`/socket.io`): one connection stays open, messages flow both ways**

```
Browser  ──Socket.IO handshake '/socket.io'──▶  nginx  ──▶  backend (ChatGateway / GameGateway)
   ▲                                                                │
   └────────────────────── messages pushed anytime ─────────────────┘
```

Example: during a match, drawing strokes, round timers, and chat messages get pushed the instant they happen — no repeated `fetch()` calls, no waiting for a request.

### Real-time gateways — `chat/chat.gateway.ts` and `game/game.gateway.ts`

There is no separate real-time process. `ChatGateway` and `GameGateway` are ordinary NestJS providers decorated with `@WebSocketGateway()`, running inside the same `backend` container as the REST API, each on its own Socket.IO namespace (`/chat`, `/game`) so their events don't collide. They share `UserService`/`ChatService` directly (in-process method calls, not HTTP) and can query MariaDB like any other service.

Each gateway authenticates the socket with the same JWT used for REST (`server.use(...)` middleware verifying the `Authorization`/`auth.token` handshake field before the client can emit anything), and keeps its own in-memory `Map<socketId, userId>` to translate a volatile `socket.id` into the durable DB user id. See `game.md` for `GameGateway`'s full event table and its reconnect-grace-period handling.

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
| `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` | Real-time transport for `ChatGateway` and `GameGateway`. |
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

For the full container list, port map, network-isolation diagram, and per-container healthchecks, see the root [`README.md`](../../README.md#container-overview) — this doc stays focused on what's inside the `backend` container itself.

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