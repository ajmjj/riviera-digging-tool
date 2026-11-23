// @ts-check
import { readFileSync } from "node:fs";

const thresholds = JSON.parse(
  readFileSync(new URL("./ci/thresholds.json", import.meta.url), "utf8"),
);
const scope = JSON.parse(readFileSync(new URL("./ci/scope.json", import.meta.url), "utf8"));

export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.ts", related: true },
  mutate: scope.domain,
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { high: 90, low: thresholds.mutation.break, break: thresholds.mutation.break },
  incremental: false,
  tempDirName: ".stryker-tmp",
};
