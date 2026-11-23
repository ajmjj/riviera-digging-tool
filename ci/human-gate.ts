// The `human-gate` check (constitution, Human Checkpoints). Runs under
// `pull_request_target` from the base branch's code; reads the PR only through the API.
// On every new commit it removes `human-approved`, so approval always covers the last commit.
import { changedFilenames, labelNames, toLabelEvents } from "./lib/github.ts";
import { evaluateGate, LABELS } from "./lib/human-gate.ts";
import { env, githubFromEnv, prop, readJson, stringList, summary } from "./io.ts";

const gh = githubFromEnv();
const number = env("PR_NUMBER");
const action = process.env["EVENT_ACTION"] ?? "";
const config = readJson("ci/protected-paths.json");
const owner = String(prop(config, "owner"));
const protectedPaths = stringList(prop(config, "paths"), "ci/protected-paths.json paths");

let labels = labelNames(await gh.get(`/repos/${gh.repo}/issues/${number}`));
// Both approvals cover only the commits Antn saw: every new commit removes them.
if (action === "synchronize") {
  for (const label of [LABELS.approved, LABELS.exception]) {
    if (labels.includes(label)) {
      await gh.send(
        "DELETE",
        `/repos/${gh.repo}/issues/${number}/labels/${encodeURIComponent(label)}`,
      );
      labels = labels.filter((l) => l !== label);
      console.log(`New commit pushed: removed "${label}". Antn has to approve again.`);
    }
  }
}

const timeline = await gh.getAll(`/repos/${gh.repo}/issues/${number}/timeline`);
const events = toLabelEvents(timeline);
for (const e of events) {
  console.log(
    `label event: ${e.event} "${e.label}" by @${e.actor} via ${e.viaApp ?? "no app"} at ${e.createdAt}`,
  );
}

const result = evaluateGate({
  changedFiles: changedFilenames(await gh.getAll(`/repos/${gh.repo}/pulls/${number}/files`)),
  labels,
  events,
  protectedPaths,
  owner,
});
for (const line of result.lines) {
  console.log(line);
}
summary(
  `**Human gate:** ${result.pass ? "passed" : "waiting for Antn"}\n\n${result.lines.join("\n\n")}`,
);
process.exit(result.pass ? 0 : 1);
