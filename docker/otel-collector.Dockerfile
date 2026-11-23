# The core OpenTelemetry Collector image has no shell or probe tool, so its compose healthcheck could not run (research R8).
# This adds only a static busybox for `busybox wget --spider` of its own readiness URL.
FROM busybox:1.38.0-musl@sha256:80e38f9a1b39188b8bdb28879178edb322a4402b081a9aedda1924609decd6f6 AS busybox

FROM otel/opentelemetry-collector:0.165.0@sha256:34b24b740c3c88d3467740e8642a397c13898ef76d7295c5425164c482ed1b73
COPY --from=busybox /bin/busybox /bin/busybox
