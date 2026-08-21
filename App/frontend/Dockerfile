# BeautyFit frontend — dev and production images.
#
# Targets:
#   dev  — Vite dev server proxying /api to the backend container (docker compose default)
#   prod — static build served by nginx with an /api reverse proxy

# --- Base stage with pnpm ---
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Dev stage ---
FROM base AS dev
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install
COPY . .
EXPOSE 5173
CMD ["sh", "-c", "pnpm exec vite --host 0.0.0.0 --port ${VITE_PORT:-5173}"]

# --- Build stage ---
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install
COPY . .
RUN pnpm exec tsc --noEmit && pnpm exec vite build

# --- Production stage ---
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]