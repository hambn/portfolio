# API → Node. Build context is the repo root.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --workspace @portfolio/api
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY content/links/links.json ./content/links/links.json
RUN npm run build --workspace @portfolio/api

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production API_DATA_DIR=/data
COPY --from=build /app/apps/api/dist ./dist
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO /dev/null "http://127.0.0.1:${PORT:-8787}/health" || exit 1
CMD ["node", "dist/server.mjs"]
