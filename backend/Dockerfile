# Fletch backend: Fastify API + on-chain indexer (single container).
# SQLite lives on a mounted volume — set DATABASE_PATH=/data/indexer.db.

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p /data
VOLUME /data
ENV DATABASE_PATH=/data/indexer.db
ENV PORT=3001
EXPOSE 3001
# indexer follows the chain in the background; API serves in the foreground
CMD ["sh", "-c", "node dist/cli/index.js --watch & exec node dist/server.js"]
