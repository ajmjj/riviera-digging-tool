import { trace } from "@opentelemetry/api";
import { startTestTelemetry } from "@riviera/telemetry/testing";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { withStaff } from "../src/http/request-context.ts";

// Request context via app.inject() (data-model.md §1, contracts/http.md#every-route).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let app: FastifyInstance | undefined;
let raw: string[] = [];

afterEach(async () => {
  await app?.close();
  app = undefined;
  raw = [];
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lines(): Record<string, unknown>[] {
  return raw.map((line): unknown => JSON.parse(line)).filter(isRecord);
}

/** The real app at `info`, with a `/probe` route that logs once while handling the request. */
function appWith(pingDatabase: () => Promise<void> = () => Promise.resolve()): FastifyInstance {
  app = buildApp({
    logger: { service: "riviera-api", env: "ci", level: "info", write: (line) => raw.push(line) },
    pingDatabase,
  });
  app.get("/probe", (request) => {
    request.log.info("probe handled");
    return { ok: true };
  });
  return app;
}

describe("request ID (001/FR-003)", () => {
  it("001/FR-003: a valid X-Request-Id is used and echoed", async () => {
    const res = await appWith().inject({
      url: "/probe",
      headers: { "x-request-id": "req_A-1" },
    });
    expect(res.headers["x-request-id"]).toBe("req_A-1");
    expect(lines().length).toBeGreaterThan(0);
    expect(lines().every((line) => line["request_id"] === "req_A-1")).toBe(true);
  });

  it("001/FR-003: a 64-character ID is accepted", async () => {
    const id = "a".repeat(64);
    const res = await appWith().inject({ url: "/probe", headers: { "x-request-id": id } });
    expect(res.headers["x-request-id"]).toBe(id);
  });

  it("001/FR-003: a missing header gets a generated UUID", async () => {
    const res = await appWith().inject("/probe");
    expect(res.headers["x-request-id"]).toMatch(UUID);
  });

  it.each([
    ["too long", "a".repeat(65)],
    ["control characters", "req\u0007id"],
    ["invalid characters", "req id;drop"],
    ["email-shaped", "someone@example.com"],
    ["empty", ""],
  ])(
    "001/FR-003: an invalid header (%s) gets a generated UUID and is never logged as sent",
    async (_case, sent) => {
      const res = await appWith().inject({ url: "/probe", headers: { "x-request-id": sent } });
      const generated = res.headers["x-request-id"];
      expect(generated).toMatch(UUID);
      expect(lines().length).toBeGreaterThan(0);
      for (const line of lines()) {
        expect(line["request_id"]).toBe(generated);
      }
      if (sent !== "") {
        expect(raw.join("")).not.toContain(JSON.stringify(sent).slice(1, -1));
      }
    },
  );

  it("001/FR-003: a repeated header is not trusted", async () => {
    const res = await appWith().inject({
      url: "/probe",
      headers: { "x-request-id": ["req_1", "req_2"] },
    });
    expect(res.headers["x-request-id"]).toMatch(UUID);
    expect(raw.join("")).not.toContain("req_1");
  });

  it("001/FR-003: the header is returned on 404s too", async () => {
    const res = await appWith().inject({ url: "/missing", headers: { "x-request-id": "r404" } });
    expect(res.statusCode).toBe(404);
    expect(res.headers["x-request-id"]).toBe("r404");
  });
});

describe("request ID on log lines (001/FR-002)", () => {
  it("001/FR-002: every log line of a request carries its request_id", async () => {
    const server = appWith();
    await server.inject({ url: "/probe", headers: { "x-request-id": "first" } });
    await server.inject({ url: "/probe", headers: { "x-request-id": "second" } });
    const messages = lines().map((line) => [line["msg"], line["request_id"]]);
    expect(messages).toEqual([
      ["incoming request", "first"],
      ["probe handled", "first"],
      ["request completed", "first"],
      ["incoming request", "second"],
      ["probe handled", "second"],
      ["request completed", "second"],
    ]);
  });
});

describe("withStaff (001/FR-004)", () => {
  it("001/FR-004: staff_test_0001 is on later log lines and on the active span", async () => {
    const telemetry = startTestTelemetry();
    try {
      const server = appWith();
      server.get("/staff", (request, reply) => {
        request.log.info("before staff");
        trace.getTracer("t").startActiveSpan("handler", (span) => {
          withStaff(request, "staff_test_0001", reply);
          span.end();
        });
        request.log.info("as staff");
        return { ok: true };
      });
      await server.inject("/staff");
      const byMessage = new Map(lines().map((line) => [line["msg"], line]));
      expect(byMessage.get("before staff")).not.toHaveProperty("staff_id");
      expect(byMessage.get("as staff")).toMatchObject({ staff_id: "staff_test_0001" });
      expect(byMessage.get("request completed")).toMatchObject({ staff_id: "staff_test_0001" });
      const spans = await telemetry.spans();
      expect(spans.map((span) => span.attributes["riviera.staff_id"])).toEqual(["staff_test_0001"]);
    } finally {
      await telemetry.shutdown();
    }
  });

  it("001/FR-004: works without an active span", () => {
    const target = { log: appWith().log };
    withStaff(target, "staff_test_0001");
    target.log.info("outside a request");
    expect(lines()).toMatchObject([{ msg: "outside a request", staff_id: "staff_test_0001" }]);
  });

  it.each([
    ["email-shaped", "someone@example.com"],
    ["a name", "Jane Doe"],
    ["empty", ""],
    ["too long", "s".repeat(65)],
  ])("001/FR-004: rejects %s values without repeating them", (_case, value) => {
    const target = { log: appWith().log };
    const before = target.log;
    expect(() => {
      withStaff(target, value);
    }).toThrow(new TypeError("withStaff: not a pseudonymous staff ID"));
    expect(target.log).toBe(before);
  });
});

describe("health endpoints (001/FR-007)", () => {
  it("001/FR-007: healthy /healthz and /readyz write no lines but return X-Request-Id", async () => {
    const server = appWith();
    const healthz = await server.inject("/healthz");
    const readyz = await server.inject("/readyz");
    expect([healthz.statusCode, readyz.statusCode]).toEqual([200, 200]);
    expect(healthz.headers["x-request-id"]).toMatch(UUID);
    expect(readyz.headers["x-request-id"]).toMatch(UUID);
    expect(raw).toEqual([]);
  });

  it("001/FR-007: a failing /readyz writes exactly one warn line", async () => {
    const server = appWith(() => Promise.reject(new Error("connect ECONNREFUSED")));
    const res = await server.inject({ url: "/readyz", headers: { "x-request-id": "ready_1" } });
    expect(res.statusCode).toBe(503);
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({
      level: "warn",
      msg: "readiness check failed",
      check: "database",
      request_id: "ready_1",
      err: { type: "Error", message: "connect ECONNREFUSED" },
    });
  });
});
