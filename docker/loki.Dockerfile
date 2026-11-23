# The Loki image has no shell or probe tool, so its compose healthcheck could not run (research R8).
# This adds only a static busybox for `busybox wget --spider` of its own readiness URL.
FROM busybox:1.38.0-musl@sha256:80e38f9a1b39188b8bdb28879178edb322a4402b081a9aedda1924609decd6f6 AS busybox

FROM grafana/loki:3.7.10@sha256:b43c257ccfc925d4a50b8717cac61a3b51df8c48d01847936057e5c4075a24a7
COPY --from=busybox /bin/busybox /bin/busybox
