FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./

RUN npm install --omit=dev

COPY server.js .

EXPOSE 9000

USER node

CMD ["node", "server.js"]