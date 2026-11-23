#!/usr/bin/env bash
# Locks `main` (constitution, Principle I). Antn runs this himself, once, after the first PR
# is merged, from his own terminal with his own `gh` login. Agents never run it.
#
#   ./ci/branch-protection.sh            # apply
#   ./ci/branch-protection.sh --dry-run  # print what would be sent
#
# Safe to re-run: it updates the ruleset in place.
set -euo pipefail

REPO="${REPO:-ajmjj/riviera-digging-tool}"
RULESET_NAME="main is CI-only"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Every required check. Names are job names from .github/workflows/*.yml.
# integration_id 15368 is GitHub Actions: only Actions can satisfy these checks, so nobody
# (an agent acting through Antn's account included) can post a fake "success" status.
CHECKS=(
  static tests mutation stack security
  "analyze (javascript-typescript)" "analyze (actions)"
  guard human-gate review
)

checks_json=$(printf '%s\n' "${CHECKS[@]}" | jq -R '{context: ., integration_id: 15368}' | jq -s .)

ruleset=$(jq -n --arg name "$RULESET_NAME" --argjson checks "$checks_json" '{
  name: $name,
  target: "branch",
  enforcement: "active",
  bypass_actors: [],
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    { type: "required_linear_history" },
    { type: "pull_request", parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
        allowed_merge_methods: ["squash"]
    } },
    { type: "required_status_checks", parameters: {
        strict_required_status_checks_policy: true,
        do_not_enforce_on_create: false,
        required_status_checks: $checks
    } },
    { type: "code_scanning", parameters: { code_scanning_tools: [
        { tool: "CodeQL", security_alerts_threshold: "high_or_higher", alerts_threshold: "errors" }
    ] } }
  ]
}')

run() {
  if $DRY_RUN; then
    printf 'DRY RUN: %s\n' "$*"
  else
    "$@"
  fi
}

echo "Repository: $REPO"
gh auth status >/dev/null

echo "1/5 Repository settings: squash merges only, auto-merge on, delete merged branches"
run gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F allow_auto_merge=true -F delete_branch_on_merge=true >/dev/null

echo "2/5 Actions: read-only default token, Actions may not approve PRs"
run gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read -F can_approve_pull_request_reviews=false

echo "3/5 Labels"
run gh label create needs-human --repo "$REPO" --force --color B60205 \
  --description "Needs Antn: protected paths, exceptions, or real Common Ground writes"
run gh label create human-approved --repo "$REPO" --force --color 0E8A16 \
  --description "Antn approved the latest commit. Only Antn adds this, in person."
run gh label create approved-exception --repo "$REPO" --force --color FBCA04 \
  --description "Antn allows a suppression or threshold change. Only Antn adds this."

echo "4/5 Secret scanning and push protection"
run gh api -X PATCH "repos/$REPO" --input - <<'JSON' >/dev/null || echo "   (not available on this plan; skipped)"
{"security_and_analysis": {"secret_scanning": {"status": "enabled"},
 "secret_scanning_push_protection": {"status": "enabled"}}}
JSON

echo "5/5 Ruleset \"$RULESET_NAME\" on the default branch (no bypass, admins included)"
existing=$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$RULESET_NAME\") | .id")
if $DRY_RUN; then
  echo "$ruleset" | jq .
elif [[ -n "$existing" ]]; then
  echo "$ruleset" | gh api -X PUT "repos/$REPO/rulesets/$existing" --input - >/dev/null
  echo "   updated ruleset $existing"
else
  echo "$ruleset" | gh api -X POST "repos/$REPO/rulesets" --input - >/dev/null
  echo "   created ruleset"
fi

cat <<'EOF'

Done. Still to do by hand, once:
  - Add the repository secret ANTHROPIC_API_KEY (Settings > Secrets and variables > Actions),
    and the same key under Dependabot secrets, for the independent reviewer.
  - Check Settings > Rules > Rulesets shows "main is CI-only" as Active with no bypass list.
EOF
