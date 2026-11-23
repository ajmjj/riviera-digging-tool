// Suppression and threshold guard (constitution, Principle II).
//
// In Actions it runs under `pull_request_target` from the base branch's code and reads the
// PR only through the API, so a PR can't change the guard that judges it. Locally:
//   BASE_SHA=origin/main node ci/guard.ts
import { readFileSync } from "node:fs";
import { parseUnifiedDiff } from "./lib/diff.ts";
import { findSuppressions, loweredThresholds } from "./lib/guard.ts";
import { labelNames, toLabelEvents } from "./lib/github.ts";
import { LABELS, verifyLabel } from "./lib/human-gate.ts";
import { baseRef, git, githubFromEnv, prop, readJson, summary } from "./io.ts";

const THRESHOLDS = "ci/thresholds.json";
const prNumber = process.env["PR_NUMBER"];

interface PrView {
  readonly diff: string;
  readonly baseThresholds: unknown;
  readonly headThresholds: unknown;
  readonly exceptionApproved: () => Promise<string>;
}

async function fromPullRequest(number: string): Promise<PrView> {
  const gh = githubFromEnv();
  const owner = String(prop(readJson("ci/protected-paths.json"), "owner"));
  const pr = await gh.get(`/repos/${gh.repo}/pulls/${number}`);
  const headSha = String(prop(prop(pr, "head"), "sha"));
  const diff = await gh.getText(`/repos/${gh.repo}/pulls/${number}`, "application/vnd.github.diff");
  let headThresholds: unknown;
  try {
    headThresholds = JSON.parse(
      await gh.getText(
        `/repos/${gh.repo}/contents/${THRESHOLDS}?ref=${headSha}`,
        "application/vnd.github.raw+json",
      ),
    );
  } catch {
    headThresholds = {};
  }
  return {
    diff,
    baseThresholds: JSON.parse(readFileSync(THRESHOLDS, "utf8")),
    headThresholds,
    exceptionApproved: async () => {
      const issue = await gh.get(`/repos/${gh.repo}/issues/${number}`);
      const events = toLabelEvents(await gh.getAll(`/repos/${gh.repo}/issues/${number}/timeline`));
      const verdict = verifyLabel(LABELS.exception, labelNames(issue), events, owner);
      return verdict.byOwner ? "" : verdict.detail;
    },
  };
}

function fromGit(base: string): PrView {
  const show = (ref: string): unknown => {
    try {
      return JSON.parse(git("show", `${ref}:${THRESHOLDS}`));
    } catch {
      return {};
    }
  };
  return {
    diff: git("diff", "--no-color", "--unified=0", `${base}...HEAD`),
    baseThresholds: show(base),
    headThresholds: show("HEAD"),
    exceptionApproved: () => Promise.resolve("local run: exceptions can only be approved on a PR"),
  };
}

const view = prNumber === undefined ? fromGit(baseRef()) : await fromPullRequest(prNumber);
const suppressions = findSuppressions(parseUnifiedDiff(view.diff));
const lowered = loweredThresholds(view.baseThresholds, view.headThresholds);

const lines: string[] = [];
for (const v of suppressions) {
  lines.push(`${v.file}:${String(v.line)} [${v.rule}] ${v.text}`);
}
for (const problem of lowered) {
  lines.push(`${THRESHOLDS}: ${problem}`);
}

if (lines.length === 0) {
  console.log("Suppression guard: no suppressions added and no thresholds loosened.");
  summary("**Suppression guard:** clean.");
  process.exit(0);
}

console.log("Suppression guard found:");
for (const line of lines) {
  console.log(`  ${line}`);
}
const exceptionProblem = await view.exceptionApproved();
if (exceptionProblem === "") {
  console.log(`Allowed: Antn approved an exception ("${LABELS.exception}").`);
  summary(
    `**Suppression guard:** ${String(lines.length)} finding(s), allowed by Antn's exception.`,
  );
  process.exit(0);
}
console.log(`Not allowed: ${exceptionProblem}.`);
console.log("Fix the code instead, or ask Antn for an exception (only he can add the label).");
summary(`**Suppression guard:** failed.\n\n\`\`\`\n${lines.join("\n")}\n\`\`\``);
process.exit(1);
