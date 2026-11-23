import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("app logger", () => {
  it("001/FR-005: Fastify's request lines use the telemetry logger's request allow-list", async () => {
    const token = ["abc", "DEF", "123", "xyz", "789"].join("");
    const raw: string[] = [];
    const app = buildApp({
      logger: {
        service: "riviera-api",
        env: "ci",
        level: "info",
        write: (line) => {
          raw.push(line);
        },
      },
      pingDatabase: () => Promise.resolve(),
    });
    try {
      await app.inject({
        url: `/missing?token=${token}`,
        headers: { authorization: `Bearer ${token}`, cookie: `sid=${token}`, "user-agent": "t" },
      });
    } finally {
      await app.close();
    }
    expect(raw.join("")).not.toContain(token);
    const lines = raw.map((line): unknown => JSON.parse(line)).filter(isRecord);
    const incoming = lines.find((line) => line["msg"] === "incoming request");
    expect(incoming).toMatchObject({
      level: "info",
      service: "riviera-api",
      env: "ci",
      req: { method: "GET", url: "/missing?token=[REDACTED]", headers: { "user-agent": "t" } },
    });
    expect(incoming?.["req"]).not.toHaveProperty("remoteAddress");
    const completed = lines.find((line) => line["msg"] === "request completed");
    expect(completed?.["res"]).toEqual({ statusCode: 404 });
  });
});
