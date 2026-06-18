#builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

#prod
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./

RUN npm ci

COPY --from=builder /app/dist ./dist

EXPOSE 3000

USER node

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]