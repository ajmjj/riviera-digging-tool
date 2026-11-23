# Image for both `api` and `worker` (same image, different command).
# Node runs the TypeScript sources directly (type stripping), so there is no build step.
FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/mocks/package.json apps/mocks/
COPY apps/web/package.json apps/web/
COPY packages/common-ground/package.json packages/common-ground/
COPY packages/telemetry/package.json packages/telemetry/
# `@riviera/api...` also installs the dependencies of its workspace packages (telemetry).
# The optional `extra_ca` build secret lets builds run behind a TLS-intercepting proxy.
# It is not set in CI and never ends up in the image.
RUN --mount=type=secret,id=extra_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca pnpm install --frozen-lockfile --prod --filter "@riviera/api..."

FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
ENV NODE_ENV=production
# The runtime never installs packages: drop npm and corepack, and their vulnerable deps.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/telemetry/node_modules ./packages/telemetry/node_modules
COPY package.json ./
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
COPY packages/telemetry/package.json packages/telemetry/
COPY packages/telemetry/src packages/telemetry/src
USER node
CMD ["node", "apps/api/src/main.ts", "api"]
