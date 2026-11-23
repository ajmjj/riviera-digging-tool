export interface ChangedTests {
  readonly unit: readonly string[];
  readonly integration: readonly string[];
  readonly e2e: readonly string[];
}

/** Sorts the test files a PR adds or changes by the runner that executes them. */
export function selectChangedTests(changedFiles: readonly string[]): ChangedTests {
  const unit: string[] = [];
  const integration: string[] = [];
  const e2e: string[] = [];
  for (const file of changedFiles) {
    if (file.includes("node_modules/")) {
      continue;
    }
    if (file.startsWith("e2e/") && file.endsWith(".spec.ts")) {
      e2e.push(file);
    } else if (file.endsWith(".int.test.ts")) {
      integration.push(file);
    } else if (file.endsWith(".test.ts")) {
      unit.push(file);
    }
  }
  return { unit, integration, e2e };
}
