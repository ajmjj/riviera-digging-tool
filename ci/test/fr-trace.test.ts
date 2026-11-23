import { describe, expect, it } from "vitest";
import { featureOf, traceRequirements } from "../lib/fr-trace.ts";

// Requirement IDs are assembled so this file does not itself reference requirements.
const fr = (n: string): string => `FR-${n}`;

const spec = (feature: string, ...ids: string[]) => ({
  path: `specs/${feature}-auth/spec.md`,
  content: [
    "## Requirements",
    ...ids.map((id) => `- **${fr(id)}**: System MUST do ${id}.`),
    `Prose mentioning ${fr("999")} is not a definition.`,
  ].join("\n"),
});

describe("featureOf", () => {
  it("reads the feature number from a spec path", () => {
    expect(featureOf("specs/002-auth/spec.md")).toBe("002");
  });

  it("ignores files that are not a feature spec", () => {
    expect(featureOf("specs/002-auth/plan.md")).toBeUndefined();
    expect(featureOf("docs/spec.md")).toBeUndefined();
    expect(featureOf("specs/auth/spec.md")).toBeUndefined();
  });
});

describe("traceRequirements", () => {
  it("passes trivially with no specs and no references", () => {
    expect(traceRequirements([], [{ path: "a.test.ts", content: "it('x')" }])).toEqual({
      untested: [],
      unknown: [],
      unqualified: [],
      specs: 0,
      requirements: 0,
    });
  });

  it("lists requirements no test names", () => {
    const result = traceRequirements(
      [spec("002", "001", "002", "003")],
      [{ path: "a.test.ts", content: `it("002/${fr("002")}: works")` }],
    );
    expect(result.requirements).toBe(3);
    expect(result.untested).toEqual([`002/${fr("001")}`, `002/${fr("003")}`]);
  });

  it("keeps FR numbers apart per feature", () => {
    const result = traceRequirements(
      [spec("001", "001"), spec("002", "001")],
      [{ path: "a.test.ts", content: `it("001/${fr("001")}")` }],
    );
    expect(result.untested).toEqual([`002/${fr("001")}`]);
  });

  it("reports references to requirements that do not exist, with file and line", () => {
    const result = traceRequirements(
      [spec("002", "001")],
      [{ path: "b.test.ts", content: `it("002/${fr("001")}")\nit("002/${fr("007")}")` }],
    );
    expect(result.unknown).toEqual([`002/${fr("007")} (b.test.ts:2)`]);
    expect(result.untested).toEqual([]);
  });

  it("reports unqualified references", () => {
    const result = traceRequirements(
      [spec("002", "001")],
      [{ path: "c.test.ts", content: `it("002/${fr("001")}")\nit("${fr("001")}: bare")` }],
    );
    expect(result.unqualified).toEqual([`${fr("001")} (c.test.ts:2)`]);
  });

  it("skips files that are not feature specs", () => {
    const result = traceRequirements(
      [{ path: "specs/002-auth/plan.md", content: `- **${fr("001")}**: x` }],
      [],
    );
    expect(result).toMatchObject({ specs: 0, requirements: 0 });
  });
});
