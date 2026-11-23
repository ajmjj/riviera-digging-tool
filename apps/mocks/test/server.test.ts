import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildMocksServer } from "../src/server.ts";

let app: FastifyInstance;

beforeEach(() => {
  app = buildMocksServer({ logLevel: "silent" });
});

afterEach(async () => {
  await app.close();
});

const sampleShopConfig = {
  operationName: "SampleShopConfig",
  query: "query SampleShopConfig { config { shopName } }",
};

function graphql(body: unknown, headers: Record<string, string> = { authorization: "Bearer x" }) {
  return app.inject({
    method: "POST",
    url: "/graphql",
    payload: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

function next(body: unknown) {
  return app.inject({
    method: "POST",
    url: "/_mock/next",
    payload: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("mocks: health", () => {
  it("001/FR-013: /healthz answers 200 ok for the compose healthcheck", async () => {
    const res = await app.inject("/healthz");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("mocks: Common Ground POST /graphql", () => {
  it("001/FR-013: answers SampleShopConfig from the recorded fixture", async () => {
    const res = await graphql(sampleShopConfig);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { config: { shopName: "Riviera Records (mock)" } } });
  });

  it("001/FR-013: refuses a request without an Authorization header", async () => {
    const res = await graphql(sampleShopConfig, {});
    expect(res.statusCode).toBe(401);
  });

  it("001/FR-013: an unknown operation is a 400 naming the operation", async () => {
    const res = await graphql({ operationName: "Nope", query: "query Nope { x }" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ errors: [{ message: "mock: unknown operation Nope" }] });
  });

  it("001/FR-013: a body that is not a GraphQL request is a 400", async () => {
    const res = await graphql({ query: 1 });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ errors: [{ message: "mock: invalid GraphQL request" }] });
  });
});

describe("mocks: Discogs GET /releases/:id", () => {
  it("001/FR-013: answers the recorded release", async () => {
    const res = await app.inject("/releases/249504");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 249504, year: 1987 });
  });

  it("001/FR-013: any other positive integer id gets the default release", async () => {
    const res = await app.inject("/releases/7");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: 249504 });
  });

  it.each(["abc", "1.5", "0", "-3", "99999999999999999999"])(
    "001/FR-013: id %s is a 404",
    async (id) => {
      const res = await app.inject(`/releases/${id}`);
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ message: "Release not found." });
    },
  );
});

describe("mocks: control", () => {
  it("001/FR-013: _mock/next fail makes the next N Common Ground calls answer 500", async () => {
    expect((await next({ service: "common_ground", outcome: "fail", times: 2 })).statusCode).toBe(
      204,
    );
    for (let i = 0; i < 2; i += 1) {
      const res = await graphql(sampleShopConfig);
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ message: "mock failure" });
    }
    expect((await graphql(sampleShopConfig)).statusCode).toBe(200);
  });

  it("001/FR-013: _mock/next rate_limited answers 429 with Retry-After: 60", async () => {
    await next({ service: "discogs", outcome: "rate_limited" });
    const res = await app.inject("/releases/249504");
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBe("60");
    expect(res.json()).toEqual({ message: "You are making requests too quickly." });
    expect((await app.inject("/releases/249504")).statusCode).toBe(200);
  });

  it("001/FR-013: an outcome for one service leaves the other alone", async () => {
    await next({ service: "discogs", outcome: "fail", times: 1 });
    expect((await graphql(sampleShopConfig)).statusCode).toBe(200);
    expect((await app.inject("/releases/1")).statusCode).toBe(500);
  });

  it("001/FR-013: _mock/reset clears all pending outcomes", async () => {
    await next({ service: "common_ground", outcome: "fail", times: 5 });
    await next({ service: "discogs", outcome: "rate_limited", times: 5 });
    const res = await app.inject({ method: "POST", url: "/_mock/reset" });
    expect(res.statusCode).toBe(204);
    expect((await graphql(sampleShopConfig)).statusCode).toBe(200);
    expect((await app.inject("/releases/1")).statusCode).toBe(200);
  });

  it.each([
    { service: "shopify", outcome: "fail", times: 1 },
    { service: "discogs", outcome: "slow", times: 1 },
    { service: "discogs", outcome: "fail", times: 0 },
    { service: "discogs", outcome: "fail", times: 101 },
    { service: "discogs", outcome: "fail", times: 1.5 },
  ])("001/FR-013: _mock/next rejects %j with 400", async (body) => {
    const res = await next(body);
    expect(res.statusCode).toBe(400);
  });
});

describe("mocks: fixtures directory", () => {
  it("001/FR-013: refuses to start without the default Discogs release", () => {
    const dir = mkdtempSync(join(tmpdir(), "mocks-"));
    mkdirSync(join(dir, "common-ground"));
    mkdirSync(join(dir, "discogs"));
    writeFileSync(join(dir, "common-ground", "README.txt"), "not a fixture");
    writeFileSync(
      join(dir, "discogs", "release-1.json"),
      JSON.stringify({ id: 1, title: "t", year: 2000 }),
    );
    expect(() => buildMocksServer({ logLevel: "silent", fixturesDir: dir })).toThrow(
      /release-249504/,
    );
  });
});
