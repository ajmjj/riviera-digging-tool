// Thin CLI (`make dashboards`): writes the generated Grafana dashboards under
// observability/grafana/dashboards/. The Makefile target then runs Prettier over them.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { OVERVIEW_FILE, overviewDashboard } from "./overview.ts";
import { sloDashboards } from "./slo-queries.ts";

const root = new URL("../../../../observability/grafana/dashboards/", import.meta.url);
const files = [{ file: OVERVIEW_FILE, dashboard: overviewDashboard() }, ...sloDashboards()];
for (const { file, dashboard } of files) {
  const path = fileURLToPath(new URL(file, root));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(dashboard, null, 2)}\n`);
  process.stdout.write(`wrote ${path}\n`);
}
