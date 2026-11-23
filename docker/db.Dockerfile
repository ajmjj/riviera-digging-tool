# Postgres for the stack. The official image can lag on Alpine package fixes, and it ships
# an old gosu binary (Go stdlib CVEs), both of which the Trivy gate rejects. We upgrade
# packages, delete gosu, and run as the postgres user, so the entrypoint never needs it.
FROM postgres:19-alpine@sha256:8b0ff4cdf221f0c53d7fcda681d3b461be725c492cd881c5ec9c0ad25023f188
# The optional `extra_ca` build secret lets builds run behind a TLS-intercepting proxy.
# It is not set in CI and never ends up in the image.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export SSL_CERT_FILE=/run/secrets/extra_ca; fi \
    && apk upgrade --no-cache \
    && rm -f /usr/local/bin/gosu
USER postgres
