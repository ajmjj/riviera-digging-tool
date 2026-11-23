// Diff coverage (constitution, Quality Gates): 100% of changed executable lines in domain
// code, at least 90% elsewhere. Reads coverage/lcov.info from `pnpm test:coverage`.
import { readFileSync } from "node:fs";
import { diffCoverage, parseLcov, percent, type Scope } from "./lib/coverage.ts";
import { parseUnifiedDiff } from "./lib/diff.ts";
import { baseRef, git, prop, readJson, summary } from "./io.ts";

const limits = prop(readJson("ci/thresholds.json"), "diffCoverage");
const domainMin = Number(prop(limits, "domain"));
const otherMin = Number(prop(limits, "other"));
const scope: unknown = readJson("ci/scope.json");

function isScope(value: unknown): value is Scope {
  return ["source", "domain", "entrypoints", "generated", "typeOnly"].every((key) => {
    const list = prop(value, key);
    return Array.isArray(list) && list.every((g) => typeof g === "string");
  });
}
if (!isScope(scope) || Number.isNaN(domainMin) || Number.isNaN(otherMin)) {
  throw new Error("ci/scope.json or ci/thresholds.json is malformed");
}

const diff = parseUnifiedDiff(git("diff", "--no-color", "--unified=0", `${baseRef()}...HEAD`));
const hits = parseLcov(readFileSync("coverage/lcov.info", "utf8"), process.cwd());
const result = diffCoverage(diff, hits, scope);

let failed = false;
for (const [name, bucket, min] of [
  ["domain", result.domain, domainMin],
  ["other", result.other, otherMin],
] as const) {
  const pct = percent(bucket);
  const ok = pct >= min;
  failed ||= !ok;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}: ${pct.toFixed(1)}% of ${String(bucket.total)} changed line(s) covered (minimum ${String(min)}%)`,
  );
  for (const line of bucket.uncovered) {
    console.log(`  not covered: ${line}`);
  }
}
for (const file of result.unmeasured) {
  console.log(`  no test loads ${file} at all`);
}
summary(
  `**Diff coverage:** domain ${percent(result.domain).toFixed(1)}%, other ${percent(result.other).toFixed(1)}%`,
);
process.exit(failed ? 1 : 0);
