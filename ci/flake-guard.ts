// Flake guard: every test file the PR adds or changes runs N times (ci/thresholds.json,
// flakeRepeats); any failure fails the build. Usage: node ci/flake-guard.ts unit|integration|e2e
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { selectChangedTests } from "./lib/flake.ts";
import { baseRef, git, prop, readJson } from "./io.ts";

const kind = process.argv[2];
if (kind !== "unit" && kind !== "integration" && kind !== "e2e") {
  throw new Error("usage: node ci/flake-guard.ts unit|integration|e2e");
}
const repeats = Number(prop(readJson("ci/thresholds.json"), "flakeRepeats"));
const changed = git("diff", "--name-only", "--diff-filter=d", `${baseRef()}...HEAD`)
  .split("\n")
  .filter((f) => f !== "" && existsSync(f));
const files = selectChangedTests(changed)[kind];

if (files.length === 0) {
  console.log(`Flake guard (${kind}): no new or changed tests. Passing trivially.`);
  process.exit(0);
}

console.log(
  `Flake guard (${kind}): running ${String(files.length)} file(s) ${String(repeats)} times.`,
);
const command: [string, string[]] =
  kind === "e2e"
    ? ["pnpm", ["exec", "playwright", "test", `--repeat-each=${String(repeats)}`, ...files]]
    : ["pnpm", ["exec", "vitest", "run", "--project", kind, ...files]];

const runs = kind === "e2e" ? 1 : repeats;
for (let run = 1; run <= runs; run += 1) {
  console.log(`run ${String(run)}/${String(runs)}`);
  execFileSync(command[0], command[1], { stdio: "inherit" });
}
console.log("No flakes.");
