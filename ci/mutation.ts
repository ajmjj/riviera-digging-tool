// Mutation testing on domain code (constitution, Principle IV). Runs Stryker over the
// globs in ci/scope.json `domain`, breaking below ci/thresholds.json `mutation.break`.
// Until domain code exists there is nothing to mutate, and the check passes trivially.
import { execFileSync } from "node:child_process";
import { git, prop, readJson, stringList } from "./io.ts";
import { matchesAny } from "./lib/diff.ts";

const domain = stringList(prop(readJson("ci/scope.json"), "domain"), "ci/scope.json domain");
const files = git("ls-files")
  .split("\n")
  .filter((f) => f.endsWith(".ts") && matchesAny(f, domain));

if (files.length === 0) {
  console.log("Mutation testing: no domain code yet. Passing trivially.");
  process.exit(0);
}
console.log(`Mutation testing: ${String(files.length)} domain file(s).`);
execFileSync("pnpm", ["exec", "stryker", "run"], { stdio: "inherit" });
