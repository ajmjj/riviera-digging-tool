#!/usr/bin/env bash
# Trivy over every image of both compose profiles (constitution Quality Gates, 001/FR-021, research
# R11), run by the CI `stack` job after the images are built. Scans and reports every image, then
# fails if any failed.
#
# Time-boxed exceptions (PR #52): a file in ci/trivy-exceptions/ is passed as --ignorefile only to
# the exact image reference on its `# image:` line. A file with a `# from: <Dockerfile> <base>`
# line also applies only while that Dockerfile still has `FROM <base>`. Bumping a pin or a base
# therefore drops the exception instead of inheriting it. Every other image is scanned with none.
# An exception file that matches no image is reported as a warning, so a stale one is visible.
# If the image list can't be read or is empty, the scan fails rather than passing on nothing.
set -euo pipefail
trivy=${TRIVY:-/tmp/trivy}
cd "$(dirname "$0")/.."

ignorefile_for() {
  local image=$1 file dockerfile base
  for file in ci/trivy-exceptions/*.yaml; do
    [ -e "$file" ] || continue
    [ "$(sed -n 's/^# image: //p' "$file")" = "$image" ] || continue
    read -r dockerfile base <<<"$(sed -n 's/^# from: //p' "$file")" || true
    if [ -n "${dockerfile:-}" ] && ! grep -qxF "FROM $base" "$dockerfile"; then
      echo "::warning::$file not applied: $dockerfile no longer starts from $base" >&2
      continue
    fi
    echo "$file"
    return
  done
}

if ! listed=$(docker compose --profile dev --profile observability config --images); then
  echo "::error::docker compose could not list the stack's images; nothing was scanned"
  exit 1
fi
images=$(sort -u <<<"$listed")
if [ -z "$images" ]; then
  echo "::error::docker compose listed no images; nothing was scanned"
  exit 1
fi

for file in ci/trivy-exceptions/*.yaml; do
  [ -e "$file" ] || continue
  ref=$(sed -n 's/^# image: //p' "$file")
  if ! grep -qxF "$ref" <<<"$images"; then
    echo "::warning::$file names ${ref:-no image} on its # image: line, which is not in the stack"
  fi
done

rc=0
while read -r image; do
  ignore=()
  file=$(ignorefile_for "$image")
  if [ -n "$file" ]; then
    echo "::notice::$image scanned with the time-boxed exceptions in $file"
    ignore=(--ignorefile "$file")
  fi
  "$trivy" image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed --no-progress \
    "${ignore[@]}" "$image" || rc=1
done <<<"$images"
exit "$rc"
