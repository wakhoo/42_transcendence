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