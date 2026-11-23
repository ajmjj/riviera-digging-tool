// SLO metric check (constitution, Principle VII): every metric in ci/slo-catalog.json must
// be registered in the telemetry package. The registry arrives with 001 (observability
// baseline); until it exists this check validates the catalog and passes trivially.
// 001 also adds the export test: each registered instrument reaches an in-memory OTLP
// exporter.
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { missingMetrics, parseCatalog, requiredMetrics } from "./lib/slo.ts";
import { prop, readJson, summary } from "./io.ts";

const catalog = parseCatalog(readJson("ci/slo-catalog.json"));
if (Array.isArray(catalog)) {
  console.log("ci/slo-catalog.json is invalid:");
  for (const problem of catalog) {
    console.log(`  ${problem}`);
  }
  process.exit(1);
}

const required = requiredMetrics(catalog);
console.log(
  `SLO catalog: ${String(catalog.slos.length)} SLOs, ${String(required.length)} metrics.`,
);

if (!existsSync(catalog.registry)) {
  console.log(`${catalog.registry} does not exist yet (001). Passing trivially.`);
  summary("**SLO metrics:** catalog valid; registry arrives with 001.");
  process.exit(0);
}

const registry: unknown = await import(pathToFileURL(catalog.registry).href);
const names = prop(registry, "SLO_METRIC_NAMES");
if (!Array.isArray(names) || !names.every((n) => typeof n === "string")) {
  console.log(`${catalog.registry} must export SLO_METRIC_NAMES: readonly string[]`);
  process.exit(1);
}
const missing = missingMetrics(catalog, names);
for (const name of missing) {
  console.log(`  missing: ${name}`);
}
summary(
  `**SLO metrics:** ${missing.length === 0 ? "all registered" : `${String(missing.length)} missing`}`,
);
process.exit(missing.length === 0 ? 0 : 1);
