#builder : install et compile le TS
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache python3 make g++

# exact lock file install
RUN npm ci

COPY . .

#compile srcs/*.ts dans dist/*.js
RUN npm run build

#production : image final
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

#recuperation uniquement des dossier compile du stage 1
COPY --from=builder /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/main"]