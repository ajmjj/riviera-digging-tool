---
name: "next-tasks"
description: "Report which tasks of a feature can start now, which can run in parallel without colliding, and write a start prompt for each. Read-only."
argument-hint: "Feature directory, e.g. specs/001-observability-baseline (default: the newest specs/NNN-*)"
user-invocable: true
disable-model-invocation: false
---

# Next tasks

Read-only. Change no files, push nothing, and open no PRs. The output is a report and start prompts that the user pastes into new sessions.

## User input

```text
$ARGUMENTS
```

If the input is empty, use the `specs/NNN-*` directory with the highest number.

## 1. Get the true state from GitHub, not the local checkout

1. Run `git fetch origin main`. Read `<feature>/tasks.md` from `origin/main` with `git show origin/main:<path>`; the local working tree may be stale.
2. **Done** = tasks marked `[X]` on `origin/main`, plus tasks in a merged PR whose title starts with the task ID (`T003: …`). The PR counts even if the checkbox wasn't updated. Use the GitHub MCP tools (`list_pull_requests`, state `closed`, keep those with `merged: true`).
3. **In progress** = tasks named in the title of an open PR. Note each PR's number and failing checks, and whether it waits only on Antn's labels (`approved-exception`, `human-approved`).
4. **Not started** = everything else.

## 2. Work out what is ready

1. Each unchecked task's own `Depends on …` list is authoritative; the summary graph in tasks.md is not.
2. **Ready** = not started, and every dependency is done. **Waiting** = not started, with a dependency not yet done; list the missing ones.
3. For each ready task, count how many later tasks depend on it, directly or transitively. More dependents means it is closer to the critical path, so start it first.

## 3. Find collisions between ready tasks

From each task line, collect the paths in backticks, and note any `Adds <package>` (which means the lockfile changes). Two ready tasks **collide** when they share:
- a file
- a workspace `package.json`, or `pnpm-lock.yaml` (both add dependencies)
- `docker-compose.yml`, a Dockerfile, or `Makefile`

Ignore `tasks.md`: each PR ticks a different line.

For each colliding pair, say which to merge first: the smaller one, or the one that adds a package the other also uses. The second PR then merges `main` back in and re-runs `pnpm install` if the lockfile is involved.

Also check each ready task against `ci/protected-paths.json`, and flag any that would touch a protected path.

## 4. Gather carry-forward notes

Collect items deferred to a later task ID from these sources:
- the descriptions of the last few merged PRs of this feature (lines such as "T004/T005 (later): …"), and their review threads (replies such as "goes into T004/T005")
- tasks.md and plan.md notes that name a task

Attach each note to the task it names. Only these sources count. Never invent notes. If the user mentioned notes in this conversation, include those too.

## 5. Report

Keep it short:

1. **State**: done, in progress (PR link, and what each PR waits on) and ready, each in one line.
2. **Ready now**: a table with task, what it builds, size estimate, number of dependents, and collides with.
3. **Recommended wave**: the largest set of ready tasks with no collisions, critical path first, and the merge order for any pair that collides. Remind the user that every PR needs Antn's `approved-exception`, and then `human-approved` after its last commit (constitution II), so the number of PRs at once is limited by Antn's review time.
4. **Next unlocks**: which waiting tasks become ready once this wave merges.

## 6. Start prompts

For each task in the recommended wave, write one fenced `text` block, ready to paste into a new session:

```text
/speckit-implement <TASK> for <feature dir>. Open one PR, labelled needs-human.
First, rename this session to "<NNN> <TASK>: <short title>".
Before starting, restart the branch from the latest origin/main (<last merged task and PR> has merged).

Carry forward these notes (put each in the PR description of the task that does it):
- <TASK> (this PR): fr-trace still has untested FRs, so ask Antn for approved-exception and note that
  human-approved is needed after the last commit. <Add packages at the exact versions from
  plan.md Technical Context, in the workspace's own package.json.> Every FR reference in tests and
  comments carries the <NNN>/ prefix. Keep the PR near the ~400-line limit; if it goes over, say so
  and include the size in the approved-exception request.
- <each carry-forward note for this task>
- <later tasks' notes, verbatim, so they keep travelling>
Watch the PR after opening it, and keep watching it until it is merged or closed: fix CI
failures and blocking review findings, reply on review threads, and tell me when it only waits
on my labels.
Don't push for non-blocking review findings; batch them into the next needed push.
```

Every start prompt MUST include the "Watch the PR" lines above. Never drop them, even when
shortening a prompt.

For the task this session will merge first, keep the "restart the branch" line. For a task that collides with an earlier one, add a line telling it to merge `main` back in once that task's PR has merged.

For the feature's last task (the one tasks.md says must pass fr-trace without an exception, e.g. T024), drop the approved-exception sentence. Keep `needs-human` only if it touches a protected path.
