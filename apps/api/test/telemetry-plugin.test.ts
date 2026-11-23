import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { createLogger } from "@riviera/telemetry/logger";
import { startTestTelemetry, type TestTelemetry } from "@riviera/telemetry/testing";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import { request as httpRequest } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HEALTHZ, isHealthRequest, READYZ, registerHealthRoutes } from "../src/health.ts";
import {
  registerRequestContext,
  requestContextOptions,
  withStaff,
} from "../src/http/request-context.ts";
import { registerTelemetry, UNMATCHED_ROUTE } from "../src/http/telemetry-plugin.ts";

// Telemetry plugin with the T004 in-memory exporters (contracts/telemetry.md#spans, #metrics),
// assembled in the order T016 wires it: request context, telemetry, then routes.

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";
const DURATION = "riviera.http.server.duration";

type ExportedSpan = Awaited<ReturnType<TestTelemetry["spans"]>>[number];

let telemetry: TestTelemetry;
const otel = () => ({
  tracer: telemetry.telemetry.tracerProvider.getTracer("test"),
  meter: telemetry.telemetry.meterProvider.getMeter("test"),
});
let app: FastifyInstance;
let raw: string[];

beforeEach(() => {
  telemetry = startTestTelemetry();
  raw = [];
  const logger: FastifyBaseLogger = createLogger({
    service: "riviera-api",
    env: "ci",
    level: "info",
    write: (line) => raw.push(line),
  });
  app = Fastify({ loggerInstance: logger, ...requestContextOptions(isHealthRequest) });
  registerRequestContext(app);
  registerTelemetry(app, otel());
  registerHealthRoutes(app, { pingDatabase: () => Promise.resolve() });
  app.get("/records/:id", (request) => {
    request.log.info("record handled");
    return { ok: true };
  });
  app.post("/staff", (request, reply) => {
    withStaff(request, "staff_test_0001", reply);
    return { body: request.body };
  });
  app.get("/broken", () => {
    throw new Error("broken on purpose");
  });
  app.get("/gone", (_request, reply) => reply.code(404).send({ gone: true }));
});

afterEach(async () => {
  await app.close();
  await telemetry.shutdown();
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function onlySpan(): Promise<ExportedSpan> {
  const spans = await telemetry.spans();
  expect(spans).toHaveLength(1);
  const [span] = spans;
  if (span === undefined) throw new Error("no span exported");
  return span;
}

/** Histogram counts of the HTTP duration metric, keyed `route method status_class`. */
async function series(): Promise<Record<string, number>> {
  const found = (await telemetry.metrics()).find((m) => m.descriptor.name === DURATION);
  const result: Record<string, number> = {};
  for (const { attributes, value } of found?.dataPoints ?? []) {
    const key = [attributes["route"], attributes["method"], attributes["status_class"]].join(" ");
    result[key] = typeof value === "number" ? value : value.count;
  }
  return result;
}

describe("001/FR-007: one SERVER span per request, named by route template", () => {
  it("001/FR-007: span name, kind and attributes use the route template, not the raw path", async () => {
    const res = await app.inject({ url: "/records/12345", headers: { "x-request-id": "req_1" } });
    expect(res.statusCode).toBe(200);

    const span = await onlySpan();
    expect(span.name).toBe("GET /records/:id");
    expect(span.kind).toBe(SpanKind.SERVER);
    expect(span.attributes).toEqual({
      "http.request.method": "GET",
      "http.route": "/records/:id",
      "http.response.status_code": 200,
      "url.scheme": "http",
      "riviera.request_id": "req_1",
    });
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
  });

  it("001/FR-007: a request that matches no route is named unmatched", async () => {
    const res = await app.inject("/no/such/path/987");
    expect(res.statusCode).toBe(404);
    const span = await onlySpan();
    expect(span.name).toBe(`GET ${UNMATCHED_ROUTE}`);
    expect(span.attributes["http.route"]).toBe(UNMATCHED_ROUTE);
    expect(span.attributes["http.response.status_code"]).toBe(404);
    expect(JSON.stringify(span.attributes)).not.toContain("/no/such/path");
  });

  it("001/FR-007: a 5xx is ERROR with its exception; a 4xx error records neither", async () => {
    expect((await app.inject("/broken")).statusCode).toBe(500);
    const bad = { "content-type": "application/json" };
    const res = await app.inject({ method: "POST", url: "/staff", payload: "{", headers: bad });
    expect(res.statusCode).toBe(400);
    const [broken, parse] = await telemetry.spans();
    expect(broken?.status.code).toBe(SpanStatusCode.ERROR);
    expect(broken?.attributes["http.response.status_code"]).toBe(500);
    expect(broken?.events.map((event) => event.name)).toEqual(["exception"]);
    expect(parse?.status.code).toBe(SpanStatusCode.UNSET);
    expect(parse?.events).toEqual([]);
  });

  it("001/FR-007, 001/FR-017: an unknown method is recorded as _OTHER, never echoed", async () => {
    await app.inject({ method: "PROPFIND", url: "/records/1" });
    const span = await onlySpan();
    expect(span.name).toBe(`_OTHER ${UNMATCHED_ROUTE}`);
    expect(span.attributes["http.request.method"]).toBe("_OTHER");
    expect(await series()).toEqual({ [`${UNMATCHED_ROUTE} _OTHER 4xx`]: 1 });
  });

  it("001/FR-007: the span is active in the handler: log lines carry its trace and span IDs", async () => {
    await app.inject("/records/1");
    const span = await onlySpan();
    const handled = raw
      .map((line): unknown => JSON.parse(line))
      .filter(isRecord)
      .find((line) => line["msg"] === "record handled");
    expect(handled?.["trace_id"]).toBe(span.spanContext().traceId);
    expect(handled?.["span_id"]).toBe(span.spanContext().spanId);
  });

  it("001/FR-007: withStaff in a handler with a parsed body sets riviera.staff_id on the span", async () => {
    const res = await app.inject({ method: "POST", url: "/staff", payload: { a: 1 } });
    expect(res.json()).toEqual({ body: { a: 1 } });
    const span = await onlySpan();
    expect(span.attributes["riviera.staff_id"]).toBe("staff_test_0001");
  });

  it.each([HEALTHZ, READYZ])("001/FR-007: %s produces no span and no metric point", async (url) => {
    const res = await app.inject(url);
    expect(res.statusCode).toBe(200);
    expect(await telemetry.spans()).toEqual([]);
    expect(await series()).toEqual({});
  });
});

describe("001/FR-011: trace context continuation", () => {
  it("001/FR-011: a valid traceparent is continued", async () => {
    await app.inject({
      url: "/records/1",
      headers: { traceparent: `00-${TRACE_ID}-${PARENT_ID}-01` },
    });
    const span = await onlySpan();
    expect(span.spanContext().traceId).toBe(TRACE_ID);
    expect(span.parentSpanContext?.spanId).toBe(PARENT_ID);
    expect(span.parentSpanContext?.isRemote).toBe(true);
  });

  it.each([
    ["malformed", { traceparent: "00-not-a-trace-01" }],
    ["all-zero trace ID", { traceparent: `00-${"0".repeat(32)}-${PARENT_ID}-01` }],
    ["missing", {}],
  ])("001/FR-011: a %s traceparent starts a new trace", async (_case, headers) => {
    await app.inject({ url: "/records/1", headers });
    const span = await onlySpan();
    expect(span.parentSpanContext).toBeUndefined();
    expect(span.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanContext().traceId).not.toBe(TRACE_ID);
  });
});

describe("001/FR-017, 001/FR-018: riviera.http.server.duration with bounded labels", () => {
  it("001/FR-017: records route template, method and status class", async () => {
    await app.inject("/records/1");
    await app.inject("/records/2");
    await app.inject({ method: "POST", url: "/staff", payload: {} });
    await app.inject("/broken");
    await app.inject("/gone");
    expect(await series()).toEqual({
      "/records/:id GET 2xx": 2,
      "/staff POST 2xx": 1,
      "/broken GET 5xx": 1,
      "/gone GET 4xx": 1,
    });
  });

  it("001/FR-018: a 404 flood adds one unmatched series, never the raw paths", async () => {
    for (let i = 0; i < 50; i++) {
      await app.inject(`/probe/${String(i)}?user=someone@example.com`);
    }
    expect(await series()).toEqual({ [`${UNMATCHED_ROUTE} GET 4xx`]: 50 });
  });

  it("001/FR-018: request IDs and staff IDs never become labels", async () => {
    await app.inject({ method: "POST", url: "/staff", headers: { "x-request-id": "req_9" } });
    const found = (await telemetry.metrics()).find((m) => m.descriptor.name === DURATION);
    const labels = found?.dataPoints.flatMap((point) => Object.keys(point.attributes)) ?? [];
    expect(new Set(labels)).toEqual(new Set(["route", "method", "status_class"]));
    expect(JSON.stringify(found)).not.toMatch(/req_9|staff_test_0001/);
  });

  it("001/FR-018: a route registered before the plugin is counted as unmatched, not rejected", async () => {
    const early = Fastify();
    early.get("/early", () => ({ ok: true }));
    registerTelemetry(early, otel());
    expect((await early.inject("/early")).statusCode).toBe(200);
    await early.close();
    expect((await onlySpan()).name).toBe("GET /early");
    expect(await series()).toEqual({ [`${UNMATCHED_ROUTE} GET 2xx`]: 1 });
  });

  it("001/FR-007: a request the client aborts still ends and exports its span, without a status code or metric point", async () => {
    const handling = new Promise<void>((resolve) => {
      app.get("/slow", () => (resolve(), new Promise(() => undefined)));
    });
    // Runs after the plugin's own onRequestAbort hook, which was registered first.
    const aborted = new Promise<void>((resolve) => {
      app.addHook("onRequestAbort", (_request, done) => {
        resolve();
        done();
      });
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (address === null || typeof address === "string") throw new Error("no port");
    const sent = httpRequest({ host: "127.0.0.1", port: address.port, path: "/slow" });
    sent.on("error", () => undefined);
    sent.end();
    await handling;
    sent.destroy();
    await aborted;
    const span = await onlySpan();
    expect(span.name).toBe("GET /slow");
    expect(span.attributes["http.response.status_code"]).toBeUndefined();
    expect(await series()).toEqual({});
  });
});
