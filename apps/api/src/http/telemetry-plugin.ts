// Fastify telemetry plugin (research R1, contracts/telemetry.md#spans and #metrics): one SERVER
// span per request, named by route template, continued from a valid `traceparent` (001/FR-007,
// FR-011), and `riviera.http.server.duration` by route, method and status class (001/FR-017,
// FR-018). Health routes get neither (001/FR-007).

import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  type Meter,
  type Span,
  type Tracer,
} from "@opentelemetry/api";
import { createInstruments, type Instruments, type LabelsOf } from "@riviera/telemetry/instruments";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { isHealthRequest } from "../health.ts";

type Labels = LabelsOf<"riviera.http.server.duration">;

/** The route of a request that matched none (data-model.md §1 `RequestContext.route`). */
export const UNMATCHED_ROUTE = "unmatched";

const METHODS: readonly Labels["method"][] = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

function knownMethod(method: string): Labels["method"] | undefined {
  return METHODS.find((known) => known === method);
}

function statusClass(code: number): Labels["status_class"] {
  if (code >= 500) return "5xx";
  if (code >= 400) return "4xx";
  if (code >= 300) return "3xx";
  if (code >= 200) return "2xx";
  return "1xx";
}

export interface TelemetryPluginOptions {
  readonly tracer: Tracer;
  /** The HTTP histogram is recorded through `createInstruments(meter, { routes })`. */
  readonly meter: Meter;
}

/**
 * Adds the telemetry hooks. Register it before any route: route templates are collected as
 * routes are added and become the closed `route` label set when the app is ready, so a 404 flood
 * adds one `unmatched` series, never one per raw path. A route the hook never saw (registered
 * earlier, or in a sibling scope) is counted as `unmatched` too, rather than rejected; its span
 * still carries the real template.
 */
export function registerTelemetry(app: FastifyInstance, options: TelemetryPluginOptions): void {
  const routes = new Set<string>();
  const active = new WeakMap<FastifyRequest, Span>();
  let instruments: Instruments | undefined;

  app.addHook("onRoute", (route) => {
    routes.add(route.url);
  });
  app.addHook("onReady", (done) => {
    instruments = createInstruments(options.meter, { routes: [...routes] });
    done();
  });

  app.addHook("onRequest", (request, _reply, done) => {
    if (isHealthRequest(request)) {
      done();
      return;
    }
    const route = request.routeOptions.url ?? UNMATCHED_ROUTE;
    // Unknown methods are not echoed into span names (semantic conventions' `_OTHER`).
    const method = knownMethod(request.method) ?? "_OTHER";
    // A missing or malformed `traceparent` extracts nothing, so the span starts a new trace.
    const parent = propagation.extract(ROOT_CONTEXT, request.headers);
    const span = options.tracer.startSpan(
      `${method} ${route}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          "http.request.method": method,
          "http.route": route,
          "url.scheme": request.protocol,
          "riviera.request_id": request.id,
        },
      },
      parent,
    );
    active.set(request, span);
    // Everything after this hook, body parsing and the handler included, runs with the span
    // active, so withStaff and the logger's trace_id/span_id mixin see it.
    context.with(trace.setSpan(parent, span), done);
  });

  // A client that disconnects before the response gets no onResponse: end the span here, so the
  // request still leaves a trace (without a status code), and record no metric point.
  app.addHook("onRequestAbort", (request, done) => {
    const span = active.get(request);
    if (span !== undefined) {
      active.delete(request);
      span.end();
    }
    done();
  });

  app.addHook("onError", (request, _reply, error, done) => {
    active.get(request)?.recordException(error);
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const span = active.get(request);
    if (span === undefined) {
      done();
      return;
    }
    active.delete(request);
    const code = reply.statusCode;
    span.setAttribute("http.response.status_code", code);
    if (code >= 500) {
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    span.end();

    const method = knownMethod(request.method);
    // A method outside the closed label set has no series; its span still records it.
    if (method !== undefined) {
      const route = request.routeOptions.url;
      instruments?.record("riviera.http.server.duration", reply.elapsedTime / 1000, {
        route: route !== undefined && routes.has(route) ? route : UNMATCHED_ROUTE,
        method,
        status_class: statusClass(code),
      });
    }
    done();
  });
}
