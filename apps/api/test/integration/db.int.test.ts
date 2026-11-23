import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db.ts";

// Runs against real Postgres: the CI `integration` job provides one, and locally
// `make test-integration` starts the compose `db` service.
const url = process.env["DATABASE_URL"];
if (url === undefined) {
  throw new Error("DATABASE_URL must be set for integration tests");
}

describe("database (real Postgres)", () => {
  it("ping succeeds against a running database", async () => {
    const db = createDatabase(url);
    try {
      await expect(db.ping()).resolves.toBeUndefined();
    } finally {
      await db.close();
    }
  });

  it("ping rejects when nothing is listening", async () => {
    const db = createDatabase("postgres://nobody:nothing@127.0.0.1:1/none");
    try {
      await expect(db.ping()).rejects.toThrow();
    } finally {
      await db.close();
    }
  });
});
