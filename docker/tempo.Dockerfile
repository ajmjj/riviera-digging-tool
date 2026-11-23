# The Tempo image has no shell or probe tool, so its compose healthcheck could not run (research R8).
# This adds only a static busybox for `busybox wget --spider` of its own readiness URL.
FROM busybox:1.38.0-musl@sha256:80e38f9a1b39188b8bdb28879178edb322a4402b081a9aedda1924609decd6f6 AS busybox

FROM grafana/tempo:2.10.10@sha256:12b0820f13ffa10ce956b6e9acc3b03f3cffded99109be6cc09d106fe56e5d38
COPY --from=busybox /bin/busybox /bin/busybox
