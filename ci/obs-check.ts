// End-to-end observability check (001/FR-033, research R14) against the stack started with
// `--profile dev --profile observability` (make up-dev). Ports default to the compose ones on
// 127.0.0.1; override with OBS_API_URL, OBS_TEMPO_URL, OBS_LOKI_URL, OBS_PROMETHEUS_URL.
import { setTimeout } from "node:timers/promises";
import { runObsCheck } from "./lib/obs-check.ts";
import { summary } from "./io.ts";

const url = (name: string, fallback: string) => process.env[`OBS_${name}_URL`] ?? fallback;
const ok = await runObsCheck(
  {
    api: url("API", "http://127.0.0.1:8080"),
    tempo: url("TEMPO", "http://127.0.0.1:3200"),
    loki: url("LOKI", "http://127.0.0.1:3100"),
    prometheus: url("PROMETHEUS", "http://127.0.0.1:9090"),
  },
  {
    fetch,
    now: () => Date.now(),
    sleep: async (ms) => {
      await setTimeout(ms);
    },
    log: (line) => {
      console.log(line);
    },
  },
);
summary(`**Observability check:** ${ok ? "all steps passed" : "failed, see the job log"}`);
process.exit(ok ? 0 : 1);
