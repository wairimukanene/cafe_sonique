FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Full source and dev dependencies: used to build, and to run migrations and the seed.
FROM deps AS tools
COPY . .

FROM tools AS build
ENV NEXT_TELEMETRY_DISABLED=1
# The env schema is checked when modules load during the build; real values are supplied at runtime.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:1/build \
    BETTER_AUTH_SECRET=build-only-placeholder-secret-replaced-at-runtime
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p .data/media .data/receipts && chown -R node:node .data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
