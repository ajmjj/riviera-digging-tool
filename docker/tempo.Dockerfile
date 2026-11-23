# The Tempo image has no shell or probe tool, so its compose healthcheck could not run (research R8).
# This adds only a static busybox for `busybox wget --spider` of its own readiness URL.
FROM busybox:1.38.0-musl@sha256:80e38f9a1b39188b8bdb28879178edb322a4402b081a9aedda1924609decd6f6 AS busybox

FROM grafana/tempo:3.1.1@sha256:64e2fbd56d9c2b3412a4b430a58ea59e91a670b1e75f920a0c702213ad145044
COPY --from=busybox /bin/busybox /bin/busybox
