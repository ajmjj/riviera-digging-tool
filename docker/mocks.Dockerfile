# Local Common Ground and Discogs mocks (contracts/mocks.md, 001/FR-013). Runs only behind the
# compose profile `dev`. Node runs the TypeScript sources directly, so there is no build step.
FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/mocks/package.json apps/mocks/
COPY apps/web/package.json apps/web/
COPY packages/common-ground/package.json packages/common-ground/
COPY packages/telemetry/package.json packages/telemetry/
# The optional `extra_ca` build secret lets builds run behind a TLS-intercepting proxy.
# It is not set in CI and never ends up in the image.
RUN --mount=type=secret,id=extra_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca pnpm install --frozen-lockfile --prod --filter @riviera/mocks

FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
ENV NODE_ENV=production
# The runtime never installs packages: drop npm and corepack, and their vulnerable deps.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/mocks/node_modules ./apps/mocks/node_modules
COPY package.json ./
COPY apps/mocks/package.json apps/mocks/
COPY apps/mocks/src apps/mocks/src
COPY apps/mocks/fixtures apps/mocks/fixtures
USER node
EXPOSE 4000
CMD ["node", "apps/mocks/src/main.ts"]
