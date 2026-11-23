# Postgres for the stack. The official image ships an old gosu binary (Go stdlib CVEs) and
# can lag on Alpine package fixes, which the Trivy gate rejects. su-exec takes the same
# arguments as gosu in the official entrypoint.
FROM postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71
# The optional `extra_ca` build secret lets builds run behind a TLS-intercepting proxy.
# It is not set in CI and never ends up in the image.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -f /run/secrets/extra_ca ]; then export SSL_CERT_FILE=/run/secrets/extra_ca; fi \
    && apk upgrade --no-cache \
    && apk add --no-cache su-exec \
    && ln -sf /sbin/su-exec /usr/local/bin/gosu
