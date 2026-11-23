// Requirement traceability (constitution, Principle III): every FR in specs/**/spec.md is
// named by a test as NNN/FR-###, and every test reference points at a real FR.
// Untested requirements pass only on a PR that carries Antn's approved-exception label
// (verified as added by him in person). Unknown or unprefixed references always fail.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { traceRequirements, type SourceFile } from "./lib/fr-trace.ts";
import { labelNames, toLabelEvents } from "./lib/github.ts";
import { LABELS, verifyLabel } from "./lib/human-gate.ts";
import { githubFromEnv, prop, readJson, summary } from "./io.ts";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", "reports", ".stryker-tmp"]);

function walk(dir: string, keep: (path: string) => boolean, out: SourceFile[] = []): SourceFile[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = dir === "." ? entry.name : join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(path, keep, out);
      }
    } else if (keep(path)) {
      out.push({ path, content: readFileSync(path, "utf8") });
    }
  }
  return out;
}

const specs = walk("specs", (p) => p.endsWith("/spec.md"));
const tests = walk(".", (p) => /\.(?:test|spec)\.ts$/.test(p));
const result = traceRequirements(specs, tests);

console.log(
  `FR traceability: ${String(result.requirements)} requirement(s) in ${String(result.specs)} spec(s), ${String(tests.length)} test file(s).`,
);
if (result.specs === 0) {
  console.log("No specs yet: nothing to trace. This check passes trivially until 001 exists.");
}

function report(title: string, items: readonly string[]): boolean {
  if (items.length === 0) {
    return false;
  }
  console.log(`${title}:`);
  for (const item of items) {
    console.log(`  ${item}`);
  }
  return true;
}

const unknownReferences = report("Tests naming a requirement that does not exist", result.unknown);
const unprefixed = report(
  "FR references without the NNN/ feature prefix (write 002/FR-012)",
  result.unqualified,
);
const badReferences = unknownReferences || unprefixed;
const untested = report("Requirements with no test", result.untested);

/** Empty if Antn approved an exception on this PR, else why not. */
async function exceptionProblem(): Promise<string> {
  const number = process.env["PR_NUMBER"];
  if (number === undefined || number === "") {
    return "not a pull request, so no exception can apply";
  }
  const gh = githubFromEnv();
  const owner = String(prop(readJson("ci/protected-paths.json"), "owner"));
  const issue = await gh.get(`/repos/${gh.repo}/issues/${number}`);
  const events = toLabelEvents(await gh.getAll(`/repos/${gh.repo}/issues/${number}/timeline`));
  const verdict = verifyLabel(LABELS.exception, labelNames(issue), events, owner);
  return verdict.byOwner ? "" : verdict.detail;
}

let failed = badReferences;
if (untested && !badReferences) {
  const problem = await exceptionProblem();
  if (problem === "") {
    console.log(`Allowed for this PR: Antn approved an exception ("${LABELS.exception}").`);
  } else {
    console.log(`Not allowed: ${problem}. Untested requirements need Antn's exception.`);
    failed = true;
  }
} else if (untested) {
  failed = true;
}
summary(`**FR traceability:** ${failed ? "failed" : "ok"} (${String(result.requirements)} FRs)`);
process.exit(failed ? 1 : 0);
