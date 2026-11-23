import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.ts";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function appWith(pingDatabase: () => Promise<void>): FastifyInstance {
  app = buildApp({ logger: { service: "riviera-api", env: "ci", level: "silent" }, pingDatabase });
  return app;
}

describe("health endpoints", () => {
  it("/healthz is 200 even when the database is down", async () => {
    const res = await appWith(() => Promise.reject(new Error("down"))).inject("/healthz");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("/readyz is 200 when the database answers", async () => {
    const res = await appWith(() => Promise.resolve()).inject("/readyz");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready", checks: { database: "ok" } });
  });

  it("/readyz is 503 when the database does not answer", async () => {
    const res = await appWith(() => Promise.reject(new Error("down"))).inject("/readyz");
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "not_ready", checks: { database: "unreachable" } });
  });
});
