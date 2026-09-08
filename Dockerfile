FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV DATA_DIR=/data
VOLUME ["/data"]

EXPOSE 4000

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
