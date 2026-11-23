import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import type { Admin } from "@riviera/common-ground";
import { DEFAULT_FIXTURES_DIR } from "../src/server.ts";
import { releaseSchema } from "../src/discogs.ts";

// Fixture contract tests (contracts/mocks.md): the recorded answers must match what the real
// services would return, as far as the committed contracts tell us.

function readFixture(...path: string[]): unknown {
  return JSON.parse(readFileSync(join(DEFAULT_FIXTURES_DIR, ...path), "utf8"));
}

// Mirrors the generated `SampleShopConfigQuery`; the type assertion below fails typecheck if
// codegen output and this schema drift apart.
const sampleShopConfigQuery = z.strictObject({
  config: z.strictObject({ shopName: z.string() }).nullable(),
});

describe("mocks: fixture contracts", () => {
  it("001/FR-013: the SampleShopConfig schema matches the generated SampleShopConfigQuery type", () => {
    expectTypeOf<
      z.infer<typeof sampleShopConfigQuery>
    >().toEqualTypeOf<Admin.SampleShopConfigQuery>();
  });

  it("001/FR-013: the SampleShopConfig fixture parses as the generated result type", () => {
    const fixture = z
      .strictObject({ data: sampleShopConfigQuery })
      .parse(readFixture("common-ground", "SampleShopConfig.json"));
    expect(fixture.data.config?.shopName).toBe("Riviera Records (mock)");
  });

  it("001/FR-013: the default Discogs release fixture parses with the Discogs schema", () => {
    const release = releaseSchema.parse(readFixture("discogs", "release-249504.json"));
    expect(release.id).toBe(249504);
  });
});
