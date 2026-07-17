FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo
ENV HUSKY=0

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/strict.json packages/tsconfig/strict.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @app/api...

COPY packages/tsconfig packages/tsconfig
COPY packages/contracts/src packages/contracts/src
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/
COPY apps/api/src apps/api/src
RUN pnpm --filter @app/contracts build && pnpm --filter @app/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig/strict.json packages/tsconfig/strict.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --prod --frozen-lockfile --ignore-scripts --filter @app/api...
COPY --from=build /repo/packages/contracts/dist packages/contracts/dist
COPY --from=build /repo/apps/api/dist apps/api/dist

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=12 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1
CMD ["node", "apps/api/dist/main.js"]
