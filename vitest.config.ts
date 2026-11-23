import { defineConfig } from "vitest/config";
import thresholds from "./ci/thresholds.json" with { type: "json" };
import scope from "./ci/scope.json" with { type: "json" };

const domainThresholds = Object.fromEntries(
  scope.domain.map((glob) => [glob, thresholds.coverage.domain]),
);

export default defineConfig({
  test: {
    // Tests must fail loudly: no retries.
    retry: 0,
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "apps/*/test/**/*.test.ts",
            "packages/*/test/**/*.test.ts",
            "ci/test/**/*.test.ts",
          ],
          exclude: ["**/*.int.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["apps/*/test/**/*.int.test.ts", "packages/*/test/**/*.int.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: scope.source,
      exclude: [...scope.entrypoints, ...scope.generated, ...scope.typeOnly],
      reporter: ["text-summary", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      thresholds: {
        ...thresholds.coverage.overall,
        ...domainThresholds,
      },
    },
  },
});
