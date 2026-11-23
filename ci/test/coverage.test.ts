import { describe, expect, it } from "vitest";
import { diffCoverage, parseLcov, percent, type Scope } from "../lib/coverage.ts";
import type { FileDiff } from "../lib/diff.ts";

const LCOV = `TN:
SF:/repo/apps/api/src/domain/price.ts
DA:1,5
DA:2,0
DA:3,2
end_of_record
SF:apps/api/src/app.ts
DA:10,1
DA:11,0
end_of_record
DA:99,1
`;

const scope: Scope = {
  source: ["apps/*/src/**/*.ts", "ci/lib/**/*.ts"],
  domain: ["apps/api/src/domain/**/*.ts"],
  entrypoints: ["apps/api/src/main.ts"],
  generated: ["packages/*/src/generated/**"],
  typeOnly: [],
};

function changed(file: string, ...lines: number[]): FileDiff {
  return { file, deleted: false, added: lines.map((line) => ({ line, text: "x" })) };
}

describe("parseLcov", () => {
  it("maps absolute and relative paths to repo-relative line hits", () => {
    const hits = parseLcov(LCOV, "/repo");
    expect([...hits.keys()]).toEqual(["apps/api/src/domain/price.ts", "apps/api/src/app.ts"]);
    expect([...(hits.get("apps/api/src/domain/price.ts") ?? [])]).toEqual([
      [1, 5],
      [2, 0],
      [3, 2],
    ]);
  });

  it("ignores DA lines outside a record", () => {
    expect(parseLcov("DA:1,1\n", "/repo").size).toBe(0);
  });
});

describe("diffCoverage", () => {
  const hits = parseLcov(LCOV, "/repo");

  it("splits changed executable lines into domain and other", () => {
    const result = diffCoverage(
      [changed("apps/api/src/domain/price.ts", 1, 2, 4), changed("apps/api/src/app.ts", 10, 11)],
      hits,
      scope,
    );
    // Line 4 is not executable (absent from lcov), so it does not count.
    expect(result.domain).toEqual({
      covered: 1,
      total: 2,
      uncovered: ["apps/api/src/domain/price.ts:2"],
    });
    expect(result.other).toEqual({ covered: 1, total: 2, uncovered: ["apps/api/src/app.ts:11"] });
    expect(result.unmeasured).toEqual([]);
  });

  it("counts every changed line of a source file no test loads as uncovered", () => {
    const result = diffCoverage([changed("apps/web/src/new.ts", 1, 2)], hits, scope);
    expect(result.other).toEqual({
      covered: 0,
      total: 2,
      uncovered: ["apps/web/src/new.ts:1", "apps/web/src/new.ts:2"],
    });
    expect(result.unmeasured).toEqual(["apps/web/src/new.ts"]);
  });

  it("ignores non-source, excluded, deleted and empty changes", () => {
    const result = diffCoverage(
      [
        changed("README.md", 1),
        changed("apps/api/test/a.test.ts", 1),
        changed("apps/api/src/main.ts", 1),
        changed("packages/cg/src/generated/admin.ts", 1),
        { file: "apps/api/src/old.ts", deleted: true, added: [] },
        changed("apps/api/src/empty.ts"),
      ],
      hits,
      scope,
    );
    expect(result.domain.total + result.other.total).toBe(0);
    expect(result.unmeasured).toEqual([]);
  });
});

describe("percent", () => {
  it("is 100 for an empty bucket and the covered share otherwise", () => {
    expect(percent({ covered: 0, total: 0, uncovered: [] })).toBe(100);
    expect(percent({ covered: 9, total: 10, uncovered: [] })).toBe(90);
  });
});
