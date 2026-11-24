// End-to-end observability check (001/FR-033, research R14) against the stack started with
// `--profile dev --profile observability` (make up-dev), on fresh volumes. Ports default to the
// compose ones on 127.0.0.1; override with OBS_{API,TEMPO,LOKI,PROMETHEUS,GRAFANA}_URL.
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { runObsCheck, type ObsDeps } from "./lib/obs-check.ts";
import { parseCatalog } from "./lib/slo.ts";
import { readJson, summary } from "./io.ts";

const url = (name: string, fallback: string) => process.env[`OBS_${name}_URL`] ?? fallback;
const urls = {
  api: url("API", "http://127.0.0.1:8080"),
  tempo: url("TEMPO", "http://127.0.0.1:3200"),
  loki: url("LOKI", "http://127.0.0.1:3100"),
  prometheus: url("PROMETHEUS", "http://127.0.0.1:9090"),
  grafana: url("GRAFANA", "http://127.0.0.1:3300"),
};
const deps: ObsDeps = {
  fetch,
  now: () => Date.now(),
  sleep: async (ms) => {
    await setTimeout(ms);
  },
  log: (line) => {
    console.log(line);
  },
};

const catalog = parseCatalog(readJson(fileURLToPath(new URL("slo-catalog.json", import.meta.url))));
if (Array.isArray(catalog)) {
  console.log(`ci/slo-catalog.json is invalid: ${catalog.join("; ")}`);
  process.exit(1);
}
const sloIds = catalog.slos.map((s) => s.id);
const ok = await runObsCheck(urls, deps, sloIds);
summary(`**Observability check:** ${ok ? "all steps passed" : "failed, see the job log"}`);
process.exit(ok ? 0 : 1);
