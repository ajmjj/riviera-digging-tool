# Postgres for the stack. The official image can lag on Alpine package fixes, and it ships
# an old gosu binary (Go stdlib CVEs), both of which the Trivy gate rejects. We upgrade
# packages, delete gosu, and run as the postgres user, so the entrypoint never needs it.
FROM postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71
# The optional `extra_ca` build secret lets builds run behind a TLS-intercepting proxy.
# It is not set in CI and never ends up in the image.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export SSL_CERT_FILE=/run/secrets/extra_ca; fi \
    && apk upgrade --no-cache \
    && rm -f /usr/local/bin/gosu
USER postgres
