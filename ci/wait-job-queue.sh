#!/usr/bin/env bash
# Waits until the background-job queue is empty (no `queued` or `running` jobs), at most 120 s.
# The CI `stack` job runs it before each SC-006 latency measurement (research R15): every sample
# request enqueues a job, and the worker draining earlier jobs would otherwise load the stack
# during the measurement.
set -euo pipefail
query="SELECT count(*) FROM job WHERE status IN ('queued', 'running')"
left=unknown
for _ in $(seq 120); do
  left=$(docker compose exec -T -e QUERY="$query" db \
    sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$QUERY"')
  if [ "$left" = 0 ]; then
    exit 0
  fi
  sleep 1
done
echo "The job queue still holds $left jobs after 120 s."
exit 1
