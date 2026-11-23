export interface SloCatalog {
  readonly registry: string;
  readonly slos: readonly { readonly id: string; readonly metrics: readonly string[] }[];
  readonly minimumMetrics: readonly string[];
}

const METRIC_NAME = /^riviera(?:\.[a-z][a-z0-9_]*)+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Validates ci/slo-catalog.json. Returns the catalog, or the list of problems. */
export function parseCatalog(raw: unknown): SloCatalog | string[] {
  const problems: string[] = [];
  if (!isRecord(raw)) {
    return ["catalog must be an object"];
  }
  const { registry, slos, minimumMetrics } = raw;
  if (typeof registry !== "string" || registry === "") {
    problems.push("registry must be a path");
  }
  if (!isStringArray(minimumMetrics)) {
    problems.push("minimumMetrics must be a list of metric names");
  }
  const parsed: { id: string; metrics: string[] }[] = [];
  if (!Array.isArray(slos) || slos.length === 0) {
    problems.push("slos must be a non-empty list");
  } else {
    for (const [index, slo] of slos.entries()) {
      if (!isRecord(slo) || typeof slo["id"] !== "string" || !isStringArray(slo["metrics"])) {
        problems.push(`slos[${String(index)}] needs an id and a list of metrics`);
        continue;
      }
      if (slo["metrics"].length === 0) {
        problems.push(`SLO ${slo["id"]} has no metrics`);
      }
      parsed.push({ id: slo["id"], metrics: slo["metrics"] });
    }
  }
  const names = [
    ...parsed.flatMap((s) => s.metrics),
    ...(isStringArray(minimumMetrics) ? minimumMetrics : []),
  ];
  for (const name of names) {
    if (!METRIC_NAME.test(name)) {
      problems.push(`metric name "${name}" must look like riviera.area.name`);
    }
  }
  if (problems.length > 0 || typeof registry !== "string" || !isStringArray(minimumMetrics)) {
    return problems;
  }
  return { registry, slos: parsed, minimumMetrics };
}

/** Every metric the catalog requires, without duplicates. */
export function requiredMetrics(catalog: SloCatalog): string[] {
  return [...new Set([...catalog.slos.flatMap((s) => s.metrics), ...catalog.minimumMetrics])];
}

export function missingMetrics(catalog: SloCatalog, registered: readonly string[]): string[] {
  const have = new Set(registered);
  return requiredMetrics(catalog).filter((name) => !have.has(name));
}
