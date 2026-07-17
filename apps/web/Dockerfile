FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
ENV HUSKY=0

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/strict.json packages/tsconfig/strict.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @app/web...

COPY packages/tsconfig packages/tsconfig
COPY apps/web/tsconfig.json apps/web/index.html apps/web/
COPY apps/web/src apps/web/src
RUN pnpm --filter @app/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=12 \
  CMD wget -qO- http://127.0.0.1:80/health >/dev/null 2>&1 || exit 1
