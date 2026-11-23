import { readFileSync } from "node:fs";
import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { createInstruments } from "@riviera/telemetry/instruments";
import { startTestTelemetry, type TestTelemetry } from "@riviera/telemetry/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createExternalClient, ExternalCallError } from "../src/external/client.ts";
import { createCommonGround, SAMPLE_SHOP_CONFIG_DOCUMENT } from "../src/external/common-ground.ts";
import { createDiscogs } from "../src/external/discogs.ts";

// Shared outbound client with a fake fetch (001/FR-012, 001/FR-015). Planted credentials are
// built at runtime so no secret-shaped literal is committed.
const KEY = ["cg", "dev", "key", "7f3a9c"].join("-");
const TOKEN = ["discogs", "pat", "41b2"].join("-");
const MOCKS = new URL("http://mocks:4000");
const SHOP = { data: { config: { shopName: "Riviera Records (mock)" } } };
const RELEASE = { id: 249504, title: "Never Gonna Give You Up", year: 1987 };

type Answer = (signal: AbortSignal) => Promise<Response>;
interface Sent {
  readonly url: URL;
  readonly init: RequestInit;
}

let telemetry: TestTelemetry;
let sent: Sent[];
beforeEach(() => {
  telemetry = startTestTelemetry();
  sent = [];
});
afterEach(() => telemetry.shutdown());

const json =
  (status: number, body: unknown): Answer =>
  () =>
    Promise.resolve(Response.json(body, { status }));

function client(answer: Answer, options: { timeoutMs?: number; now?: () => number } = {}) {
  return createExternalClient({
    instruments: createInstruments(telemetry.telemetry.meterProvider.getMeter("t"), { routes: [] }),
    fetch: (input, init = {}) => {
      sent.push({ url: new URL(input instanceof Request ? input.url : input), init });
      if (!(init.signal instanceof AbortSignal)) throw new Error("no abort signal");
      return answer(init.signal);
    },
    ...options,
  });
}

const commonGround = (answer: Answer, apiKey = true) =>
  createCommonGround({
    client: client(answer),
    url: MOCKS,
    apiKey: apiKey ? { reveal: () => KEY } : undefined,
  });

async function onlySpan() {
  const spans = await telemetry.spans();
  expect(spans).toHaveLength(1);
  const [span] = spans;
  if (span === undefined) throw new Error("no span exported");
  return span;
}

/** Counter values, or histogram counts, keyed `service/outcome`. */
async function points(metric: string): Promise<Record<string, number>> {
  const found = (await telemetry.metrics()).find((m) => m.descriptor.name === metric);
  const result: Record<string, number> = {};
  for (const { attributes, value } of found?.dataPoints ?? []) {
    const key = `${String(attributes["service"])}/${String(attributes["outcome"])}`;
    result[key] = typeof value === "number" ? value : "count" in value ? value.count : NaN;
  }
  return result;
}

describe("001/FR-012: one client span per outbound call", () => {
  it("001/FR-012: Common Ground success records the contract attributes and no body", async () => {
    await expect(commonGround(json(200, SHOP)).sampleShopConfig()).resolves.toEqual(SHOP.data);

    const [request] = sent;
    expect(request?.url.href).toBe("http://mocks:4000/graphql");
    expect(request?.init.method).toBe("POST");
    expect(request?.init.redirect).toBe("error");
    const body = request?.init.body;
    expect(typeof body === "string" ? JSON.parse(body) : body).toEqual({
      operationName: "SampleShopConfig",
      query: SAMPLE_SHOP_CONFIG_DOCUMENT,
    });

    const span = await onlySpan();
    expect(span.name).toBe("common_ground SampleShopConfig");
    expect(span.kind).toBe(SpanKind.CLIENT);
    expect(span.attributes).toEqual({
      "riviera.external.service": "common_ground",
      "riviera.external.operation": "SampleShopConfig",
      "http.request.method": "POST",
      "http.response.status_code": 200,
      "riviera.external.rate_limited": false,
      "server.address": "mocks",
    });
    expect(span.status.code).toBe(SpanStatusCode.UNSET);
    expect(span.events).toEqual([]);
  });

  it("001/FR-012: the API key goes in Authorization only and is never recorded", async () => {
    await commonGround(json(200, SHOP)).sampleShopConfig();
    expect(new Headers(sent[0]?.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    const span = await onlySpan();
    const recorded = JSON.stringify([span.attributes, span.status, span.events]);
    expect(recorded).not.toContain(KEY);
    expect(recorded.toLowerCase()).not.toContain("authorization");
  });

  it("001/FR-012: without a key no Authorization is sent, and the mock's 401 is failed", async () => {
    await expect(commonGround(json(401, {}), false).sampleShopConfig()).rejects.toMatchObject({
      outcome: "failed",
      status: 401,
    });
    expect(new Headers(sent[0]?.init.headers).has("authorization")).toBe(false);
  });

  it.each([
    ["no data", { errors: [{ message: "boom" }] }],
    ["data and errors", { data: { config: null }, errors: [{ message: "boom" }] }],
  ])("001/FR-012: a 200 with GraphQL errors (%s) is failed, not success", async (_, body) => {
    await expect(commonGround(json(200, body)).sampleShopConfig()).rejects.toMatchObject({
      outcome: "failed",
      message: "common_ground SampleShopConfig: unexpected response",
    });
    expect(await points("riviera.external.calls")).toEqual({ "common_ground/failed": 1 });
  });

  it("001/FR-012: a 200 with config null and an empty errors list is success", async () => {
    const body = { data: { config: null }, errors: [] };
    await expect(commonGround(json(200, body)).sampleShopConfig()).resolves.toEqual({
      config: null,
    });
  });

  it("001/FR-012: the span is ended even when recording a metric throws", async () => {
    const instruments = createInstruments(telemetry.telemetry.meterProvider.getMeter("t"), {
      routes: [],
    });
    const failing = createExternalClient({
      instruments: {
        ...instruments,
        add: () => {
          throw new TypeError("recorder failed");
        },
      },
      fetch: () => Promise.resolve(Response.json(SHOP)),
    });
    const cg = createCommonGround({ client: failing, url: MOCKS, apiKey: undefined });
    await expect(cg.sampleShopConfig()).rejects.toThrow("recorder failed");
    expect((await onlySpan()).name).toBe("common_ground SampleShopConfig");
  });

  it("001/FR-012: the inlined document equals the codegen-validated .graphql file", () => {
    const path = "../../../packages/common-ground/operations/admin/SampleShopConfig.graphql";
    const file = readFileSync(new URL(path, import.meta.url), "utf8");
    const lines = file.split("\n").filter((line) => !line.startsWith("#"));
    expect(SAMPLE_SHOP_CONFIG_DOCUMENT).toBe(lines.join("\n").trim());
  });

  it("001/FR-012: the span is a child of the active span", async () => {
    const parent = trace.getTracer("t").startSpan("parent");
    const cg = commonGround(json(200, SHOP));
    await context.with(trace.setSpan(context.active(), parent), () => cg.sampleShopConfig());
    parent.end();
    const child = (await telemetry.spans()).find((s) => s.name.startsWith("common_ground"));
    expect(child?.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
  });

  it("001/FR-012: Discogs requests the given id, with the token in a header only", async () => {
    const discogs = createDiscogs({
      client: client(json(200, RELEASE)),
      url: MOCKS,
      token: { reveal: () => TOKEN },
    });
    // The mock answers release 249504 for any id, so the path sent is what proves the lookup.
    await expect(discogs.release(1234)).resolves.toEqual(RELEASE);
    const [request] = sent;
    expect(request?.url.pathname).toBe("/releases/1234");
    expect(request?.url.search).toBe("");
    expect(request?.init.method).toBe("GET");
    expect(new Headers(request?.init.headers).get("authorization")).toBe(`Discogs token=${TOKEN}`);

    const span = await onlySpan();
    expect(span.name).toBe("discogs GET /releases/{id}");
    expect(span.attributes).toMatchObject({
      "riviera.external.service": "discogs",
      "riviera.external.operation": "GET /releases/{id}",
      "http.request.method": "GET",
    });
    expect(JSON.stringify(span.attributes)).not.toContain(TOKEN);
  });

  it.each([[0], [-1], [1.5], [Number.NaN], [2 ** 53]])(
    "001/FR-012: Discogs release id %s is refused before any call",
    async (id) => {
      const discogs = createDiscogs({ client: client(json(200, RELEASE)), url: MOCKS });
      await expect(discogs.release(id)).rejects.toBeInstanceOf(RangeError);
      expect(sent).toEqual([]);
      expect(await telemetry.spans()).toEqual([]);
    },
  );
});

const hang: Answer = (signal) =>
  new Promise((_, reject) => {
    signal.addEventListener("abort", () => {
      reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
    });
  });

const stallBody: Answer = (signal) => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("{"));
      signal.addEventListener("abort", () => {
        controller.error(signal.reason);
      });
    },
  });
  return Promise.resolve(new Response(body, { status: 200 }));
};

// A network error's message may quote the URL; the client must drop it.
const refused: Answer = () => Promise.reject(new TypeError(`fetch failed ?token=${TOKEN}`));
const html: Answer = () => Promise.resolve(new Response("<html>"));

type Failure = [string, Answer, "failed" | "rate_limited", number | undefined, string];
const failures: Failure[] = [
  ["500", json(500, { message: "mock failure" }), "failed", 500, "HTTP 500"],
  ["429", json(429, { message: "too quickly" }), "rate_limited", 429, "rate limited"],
  ["timeout", hang, "failed", undefined, "timed out"],
  ["body stalls past the timeout", stallBody, "failed", 200, "timed out"],
  ["network error", refused, "failed", undefined, "network error"],
  ["200, not JSON", html, "failed", 200, "response is not JSON"],
  ["200, unexpected shape", json(200, { title: 1 }), "failed", 200, "unexpected response"],
];

describe("001/FR-012, 001/FR-015: outcomes", () => {
  it("001/FR-015: a success counts once as success, with its duration", async () => {
    let clock = 1000;
    const answer: Answer = (signal) => {
      clock += 250;
      return json(200, RELEASE)(signal);
    };
    await createDiscogs({ client: client(answer, { now: () => clock }), url: MOCKS }).release(1);
    expect(await points("riviera.external.calls")).toEqual({ "discogs/success": 1 });
    expect(await points("riviera.external.duration")).toEqual({ "discogs/success": 1 });
    const duration = (await telemetry.metrics()).find(
      (m) => m.descriptor.name === "riviera.external.duration",
    );
    expect(duration?.dataPoints[0]?.value).toMatchObject({ sum: 0.25 });
  });

  it.each(failures)(
    "001/FR-012, 001/FR-015: %s → ERROR span, counted by its outcome, no upstream text",
    async (_, answer, outcome, status, reason) => {
      const discogs = createDiscogs({ client: client(answer, { timeoutMs: 20 }), url: MOCKS });
      const error: unknown = await discogs.release(1).catch((e: unknown) => e);
      const message = `discogs GET /releases/{id}: ${reason}`;
      expect(error).toBeInstanceOf(ExternalCallError);
      expect(error).toMatchObject({ outcome, status, message });

      const span = await onlySpan();
      expect(span.status).toEqual({ code: SpanStatusCode.ERROR, message });
      expect(span.attributes["http.response.status_code"]).toBe(status);
      expect(span.attributes["riviera.external.rate_limited"]).toBe(outcome === "rate_limited");
      const recorded = JSON.stringify([span.attributes, span.events]);
      for (const upstream of ["mock failure", "too quickly", TOKEN]) {
        expect(recorded).not.toContain(upstream);
      }
      // rate_limited is its own series, never also counted as failed.
      expect(await points("riviera.external.calls")).toEqual({ [`discogs/${outcome}`]: 1 });
      expect(await points("riviera.external.duration")).toEqual({ [`discogs/${outcome}`]: 1 });
    },
  );
});
