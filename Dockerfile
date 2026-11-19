# syntax=docker/dockerfile:1

# Build the upstream frontend and a small Node entry point for the existing API.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build \
 && npx esbuild docker/server.ts \
      --bundle \
      --platform=node \
      --format=esm \
      --target=node22 \
      --packages=external \
      --outfile=dist-server/server.mjs

# Runtime contains only production dependencies and built assets.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    HIT_DATA_DIR=/data

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev \
 && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

RUN mkdir -p /data \
 && chown -R node:node /app /data

USER node
EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "/app/dist-server/server.mjs"]
