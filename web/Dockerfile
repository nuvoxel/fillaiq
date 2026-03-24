FROM node:22-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
# Placeholder env vars for build-time validation (overridden at runtime)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV BETTER_AUTH_SECRET="build-placeholder"
ENV BETTER_AUTH_URL="http://localhost:3000"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Include drizzle-kit and migration files for running migrations from the pod
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/db ./src/db
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
