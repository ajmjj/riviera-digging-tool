// Shared outbound client for Common Ground and Discogs (001/FR-012, 001/FR-015;
// contracts/telemetry.md#spans and #metrics): a CLIENT span `{service} {operation}` under the
// active span, and `riviera.external.calls` and `riviera.external.duration` by service,
// operation and outcome. Bodies, headers, URLs and upstream error text are never recorded.

import { context, diag, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Instruments, LabelsOf } from "@riviera/telemetry/instruments";
import type { Secret } from "../config.ts";

type Labels = LabelsOf<"riviera.external.calls">;
type Failure = Exclude<Labels["outcome"], "success">;

const EXTERNAL_TIMEOUT_MS = 5000;

/** A credential handed out only on request (config's `Secret`); revealed into headers only. */
export type ApiKey = Pick<Secret, "reveal">;

interface ExternalRequest<T> {
  readonly service: Labels["service"];
  readonly operation: Labels["operation"];
  readonly method: "GET" | "POST";
  readonly url: URL;
  /** Credentials go here, never in `url`. */
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  /** Validates the parsed JSON response; a throw counts the call as failed. */
  readonly parse: (body: unknown) => T;
}

/** A failed or rate-limited call. The message is fixed text, never upstream content. */
export class ExternalCallError extends Error {
  override readonly name = "ExternalCallError";
  readonly outcome: Failure;
  /** The HTTP status, when a response arrived. */
  readonly status: number | undefined;
  constructor(message: string, outcome: Failure, status: number | undefined) {
    super(message);
    this.outcome = outcome;
    this.status = status;
  }
}

export interface ExternalClient {
  readonly call: <T>(request: ExternalRequest<T>) => Promise<T>;
}

export interface ExternalClientOptions {
  readonly instruments: Instruments;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  /** Monotonic milliseconds; `performance.now` by default. */
  readonly now?: () => number;
}

type Result<T> =
  | { readonly outcome: "success"; readonly status: number; readonly value: T }
  | { readonly outcome: Failure; readonly status?: number; readonly reason: string };

const isTimeout = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "TimeoutError";

export function createExternalClient(options: ExternalClientOptions): ExternalClient {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? EXTERNAL_TIMEOUT_MS;
  const now = options.now ?? (() => performance.now());

  async function attempt<T>(request: ExternalRequest<T>): Promise<Result<T>> {
    let response: Response;
    try {
      response = await doFetch(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body === undefined ? {} : { body: request.body }),
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // The error may quote the URL; only its kind is kept.
      return { outcome: "failed", reason: isTimeout(error) ? "timed out" : "network error" };
    }
    const { status } = response;
    if (!response.ok) {
      // Discarded unread: upstream error bodies are never recorded.
      await response.body?.cancel().catch(() => undefined);
      return status === 429
        ? { outcome: "rate_limited", status, reason: "rate limited" }
        : { outcome: "failed", status, reason: `HTTP ${String(status)}` };
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (error) {
      const reason = isTimeout(error) ? "timed out" : "response is not JSON";
      return { outcome: "failed", status, reason };
    }
    try {
      return { outcome: "success", status, value: request.parse(parsed) };
    } catch {
      return { outcome: "failed", status, reason: "unexpected response" };
    }
  }

  return {
    async call(request) {
      const { service, operation } = request;
      const name = `${service} ${operation}`;
      const span = trace.getTracer("@riviera/api/external").startSpan(name, {
        kind: SpanKind.CLIENT,
        attributes: {
          "riviera.external.service": service,
          "riviera.external.operation": operation,
          "http.request.method": request.method,
          "server.address": request.url.hostname,
        },
      });
      const started = now();
      const result = await context.with(trace.setSpan(context.active(), span), () =>
        attempt(request),
      );
      const seconds = (now() - started) / 1000;

      if (result.status !== undefined) {
        span.setAttribute("http.response.status_code", result.status);
      }
      span.setAttribute("riviera.external.rate_limited", result.outcome === "rate_limited");
      if (result.outcome !== "success") {
        span.setStatus({ code: SpanStatusCode.ERROR, message: `${name}: ${result.reason}` });
      }
      span.end();

      // Telemetry never fails the call (001/FR-020): a recorder error goes to diag, whose
      // warnings the export guard rate-limits, and the call's own result stands. Each recorder
      // has its own try, so one that throws doesn't cost the other its point.
      const labels = { service, operation, outcome: result.outcome };
      try {
        options.instruments.add("riviera.external.calls", 1, labels);
      } catch {
        diag.warn(`${name}: riviera.external.calls not recorded`);
      }
      try {
        options.instruments.record("riviera.external.duration", seconds, labels);
      } catch {
        diag.warn(`${name}: riviera.external.duration not recorded`);
      }

      if (result.outcome === "success") {
        return result.value;
      }
      throw new ExternalCallError(`${name}: ${result.reason}`, result.outcome, result.status);
    },
  };
}
