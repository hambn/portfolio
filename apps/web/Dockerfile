# Static site → nginx. Build context is the repo root.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --workspace @portfolio/web
COPY packages/shared ./packages/shared
COPY content ./content
COPY apps/web ./apps/web
# Deploy target — override at build for a different route/domain.
ARG BASE_PATH=/
ARG SITE_URL=https://hgh.dev
ARG VITE_API_BASE_URL=/api
ENV BASE_PATH=$BASE_PATH SITE_URL=$SITE_URL VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build --workspace @portfolio/web

FROM nginx:1.31-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
