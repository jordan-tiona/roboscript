FROM node:24-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/
RUN pnpm install --frozen-lockfile --filter @roboscript/server

COPY packages/server/ ./packages/server/
RUN pnpm --filter @roboscript/server build

# Deploy to a clean directory with production deps only
RUN pnpm deploy --filter @roboscript/server --prod /deploy

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /deploy .
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
