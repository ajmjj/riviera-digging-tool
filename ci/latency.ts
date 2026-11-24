// SC-006 latency check (research R15), run by the CI `stack` job on the stack started with
// `--profile dev --profile observability`:
//   node ci/latency.ts baseline <file>   collector running: measure p95, write it to <file>
//   node ci/latency.ts compare <file>    collector stopped: measure p95, compare with <file>
// SMOKE_BASE_URL overrides the proxy URL (default http://127.0.0.1:8080), as for ci/smoke.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { compare, measure, p95 } from "./lib/latency.ts";
import { prop, summary } from "./io.ts";

const [mode, file] = process.argv.slice(2);
if ((mode !== "baseline" && mode !== "compare") || file === undefined) {
  console.log("usage: node ci/latency.ts baseline|compare <file>");
  process.exit(2);
}
const baseUrl = process.env["SMOKE_BASE_URL"] ?? "http://127.0.0.1:8080";
const measured = p95(await measure(baseUrl, { fetch, now: () => performance.now() }));

if (mode === "baseline") {
  writeFileSync(file, JSON.stringify({ p95Ms: measured }));
  console.log(`p95 with the collector running: ${measured.toFixed(1)} ms`);
  process.exit(0);
}
const baseline = prop(JSON.parse(readFileSync(file, "utf8")), "p95Ms");
if (typeof baseline !== "number") {
  console.log(`${file} has no p95Ms; run the baseline first`);
  process.exit(1);
}
const result = compare(baseline, measured);
console.log(result.message);
summary(`**SC-006 latency:** ${result.message}`);
process.exit(result.ok ? 0 : 1);
