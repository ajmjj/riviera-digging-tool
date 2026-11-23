# Builds the PWA and serves the static files. The proxy routes everything except /api here.
FROM node:25.9.0-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/common-ground/package.json packages/common-ground/
# The optional `extra_ca` build secret lets builds run behind a TLS-intercepting proxy.
# It is not set in CI and never ends up in the image.
RUN --mount=type=secret,id=extra_ca,required=false \
    NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca pnpm install --frozen-lockfile --filter @riviera/web
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN pnpm --filter @riviera/web build

FROM nginx:1.31.9-alpine-slim@sha256:5bfced78d24d644270bedb0a9968697042e38d5c03fb6354603df025279c1cbe
COPY docker/web.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
