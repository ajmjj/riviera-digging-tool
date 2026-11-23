import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderCodeowners, toCodeownersPattern } from "../lib/codeowners.ts";
import { selectChangedTests } from "../lib/flake.ts";
import { missingMetrics, parseCatalog, requiredMetrics } from "../lib/slo.ts";
import { runSmoke, SMOKE_STEPS } from "../lib/smoke.ts";

describe("selectChangedTests", () => {
  it("sorts changed test files by runner and ignores everything else", () => {
    expect(
      selectChangedTests([
        "apps/api/test/a.test.ts",
        "apps/api/test/integration/db.int.test.ts",
        "e2e/shell.spec.ts",
        "apps/api/src/a.ts",
        "node_modules/x/y.test.ts",
        "apps/web/src/thing.spec.ts",
      ]),
    ).toEqual({
      unit: ["apps/api/test/a.test.ts"],
      integration: ["apps/api/test/integration/db.int.test.ts"],
      e2e: ["e2e/shell.spec.ts"],
    });
  });
});

describe("CODEOWNERS", () => {
  it("converts protected globs to CODEOWNERS patterns", () => {
    expect(toCodeownersPattern(".github/**")).toBe("/.github/");
    expect(toCodeownersPattern("**/tsconfig*.json")).toBe("**/tsconfig*.json");
    expect(toCodeownersPattern("CODEOWNERS")).toBe("/CODEOWNERS");
  });

  it("stays in sync with ci/protected-paths.json (run node ci/render-codeowners.ts)", () => {
    const config: unknown = JSON.parse(readFileSync("ci/protected-paths.json", "utf8"));
    const paths: unknown = Reflect.get(Object(config), "paths");
    const owner: unknown = Reflect.get(Object(config), "owner");
    expect(Array.isArray(paths) && paths.every((p) => typeof p === "string")).toBe(true);
    expect(typeof owner).toBe("string");
    if (
      Array.isArray(paths) &&
      paths.every((p) => typeof p === "string") &&
      typeof owner === "string"
    ) {
      expect(readFileSync("CODEOWNERS", "utf8")).toBe(renderCodeowners(paths, owner));
    }
  });

  it("protects the files that define the safety net", () => {
    const text = readFileSync("ci/protected-paths.json", "utf8");
    for (const path of [".github/**", "ci/**", "CODEOWNERS", ".specify/**", "eslint.config.js"]) {
      expect(text).toContain(`"${path}"`);
    }
  });
});

describe("SLO catalog", () => {
  const valid = {
    registry: "packages/telemetry/src/slo-metrics.ts",
    slos: [
      { id: "a", metrics: ["riviera.a.count", "riviera.shared.x"] },
      { id: "b", metrics: ["riviera.shared.x"] },
    ],
    minimumMetrics: ["riviera.queue.depth"],
  };

  it("accepts a valid catalog and lists each metric once", () => {
    const catalog = parseCatalog(valid);
    expect(Array.isArray(catalog)).toBe(false);
    if (!Array.isArray(catalog)) {
      expect(requiredMetrics(catalog)).toEqual([
        "riviera.a.count",
        "riviera.shared.x",
        "riviera.queue.depth",
      ]);
      expect(missingMetrics(catalog, ["riviera.shared.x"])).toEqual([
        "riviera.a.count",
        "riviera.queue.depth",
      ]);
    }
  });

  it("rejects malformed catalogs with specific problems", () => {
    expect(parseCatalog(null)).toEqual(["catalog must be an object"]);
    expect(parseCatalog({ registry: "", slos: [], minimumMetrics: "x" })).toEqual([
      "registry must be a path",
      "minimumMetrics must be a list of metric names",
      "slos must be a non-empty list",
    ]);
    expect(
      parseCatalog({
        ...valid,
        slos: [{ id: "a", metrics: [] }, { id: 1 }, { id: "c", metrics: ["Bad Name"] }],
      }),
    ).toEqual([
      "SLO a has no metrics",
      "slos[1] needs an id and a list of metrics",
      'metric name "Bad Name" must look like riviera.area.name',
    ]);
  });

  it("the committed catalog is valid and covers every SLO in the constitution", () => {
    const catalog = parseCatalog(JSON.parse(readFileSync("ci/slo-catalog.json", "utf8")));
    expect(Array.isArray(catalog)).toBe(false);
    const constitution = readFileSync(".specify/memory/constitution.md", "utf8");
    const rows = [...constitution.matchAll(/^\| ([A-Z][^|]+?) \| [^|]+\|$/gm)]
      .map((m) => m[1] ?? "")
      .filter((name) => name !== "SLO");
    expect(rows).toHaveLength(7);
    const raw: unknown = JSON.parse(readFileSync("ci/slo-catalog.json", "utf8"));
    const get = (value: unknown, key: string): unknown =>
      value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;
    const slos = get(raw, "slos");
    const names: unknown[] = [];
    if (Array.isArray(slos)) {
      for (const slo of slos) {
        names.push(get(slo, "name"));
      }
    }
    expect(names).toEqual(rows);
  });
});

describe("runSmoke", () => {
  function fakeFetch(responses: Record<string, [number, string] | Error>): typeof fetch {
    return (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const r = responses[new URL(url).pathname];
      if (r === undefined || r instanceof Error) {
        return Promise.reject(r ?? new Error("no route"));
      }
      return Promise.resolve(new Response(r[1], { status: r[0] }));
    };
  }

  const healthy = {
    "/": [200, "<title>Riviera Dig</title>"],
    "/manifest.webmanifest": [200, '{"name":"Riviera Dig"}'],
    "/api/healthz": [200, '{"status":"ok"}'],
    "/api/readyz": [200, '{"status":"ready"}'],
  } satisfies Record<string, [number, string]>;

  it("passes when every step passes and logs each one", async () => {
    const lines: string[] = [];
    await expect(runSmoke("http://x", fakeFetch(healthy), (l) => lines.push(l))).resolves.toBe(
      true,
    );
    expect(lines).toHaveLength(SMOKE_STEPS.length);
    expect(lines.every((l) => l.startsWith("PASS"))).toBe(true);
  });

  it("fails on a wrong status, wrong body or network error, and still runs every step", async () => {
    const lines: string[] = [];
    const broken = {
      ...healthy,
      "/": [200, "<title>Other</title>"],
      "/api/readyz": [503, '{"status":"not_ready"}'],
      "/api/healthz": new Error("refused"),
    } satisfies Record<string, [number, string] | Error>;
    await expect(runSmoke("http://x", fakeFetch(broken), (l) => lines.push(l))).resolves.toBe(
      false,
    );
    expect(lines.map((l) => l.slice(0, 4))).toEqual(["FAIL", "PASS", "FAIL", "FAIL"]);
    expect(lines[2]).toContain("refused");
    expect(lines[3]).toContain("HTTP 503");
  });
});
