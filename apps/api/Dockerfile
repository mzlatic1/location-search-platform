FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --no-frozen-lockfile
COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @location/api build
EXPOSE 4000
CMD ["pnpm","--filter","@location/api","start"]
