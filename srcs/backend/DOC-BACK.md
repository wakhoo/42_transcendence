# doc-back.md — Backend skeleton files

A short reference describing the role of each file in the NestJS backend skeleton.

## Config files

### `nest-cli.json`
This is the configuration of the `nest` command-line tool — the one behind `nest start` and `nest build`. It tells `nest` where to find the source code and how to build it.

### `package.json`
This is the identity card of the Node project. It states two essential things: what the code needs in order to run (the dependencies), and which commands exist (the scripts). Without it, `npm install` doesn't know what to install, and `npm run start:dev` doesn't exist.

### `tsconfig.json`
The `tsconfig` is the bridge between TypeScript and the JavaScript that Node executes. Node doesn't understand TypeScript directly, so this file tells the compiler how to translate the code and which typing rules to apply.

## Source files

### `main.ts`
This is the entry point — the very first file that runs. Its job: start the HTTP server. Everything flows out of it.

### `app.module.ts`
This is the root module, the assembly point. It wires together all the pieces of the app. NestJS organizes code into modules: boxes that group together things that belong together. The root module declares the controllers and imports the sub-modules.

### `health.controller.ts`
The controller is the mapping table between incoming requests and the code. Without it, the server runs but doesn't know how to answer anything. It declares all the routes of the class, tells the method right below it to respond to GET requests on the given path, and runs it.

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