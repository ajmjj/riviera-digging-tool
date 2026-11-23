// Request context (data-model.md §1, contracts/http.md#every-route): the request ID of
// 001/FR-002 and FR-003 and the staff ID of 001/FR-004.

import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { trace } from "@opentelemetry/api";
import {
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyRequest,
} from "fastify";
import { isOpaqueId, isStaffId } from "../staff-id.ts";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Fastify's `genReqId`: the client's `X-Request-Id` if it is a valid opaque ID, else a new
 * UUID. An invalid header is dropped here and never reaches a log line or a response.
 */
function requestId(request: IncomingMessage): string {
  const sent = request.headers[REQUEST_ID_HEADER];
  return typeof sent === "string" && isOpaqueId(sent) ? sent : randomUUID();
}

export interface RequestContextOptions {
  readonly requestIdHeader: false;
  readonly genReqId: (request: IncomingMessage) => string;
  readonly logController: LogController;
}

/**
 * Fastify options for the request context. Fastify's own header handling is off, so only the
 * validated ID is used, and every request's child logger binds it as `request_id`. Requests
 * for which `quiet` is true get no "incoming request" or "request completed" lines (FR-007).
 */
export function requestContextOptions(
  quiet: (request: FastifyRequest) => boolean,
): RequestContextOptions {
  return {
    requestIdHeader: false,
    genReqId: requestId,
    logController: new LogController({
      requestIdLogLabel: "request_id",
      disableRequestLogging: quiet,
    }),
  };
}

/** Returns the request ID in the `X-Request-Id` response header of every route (FR-003). */
export function registerRequestContext(app: FastifyInstance): void {
  app.addHook("onRequest", (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });
}

export interface StaffTarget {
  log: FastifyBaseLogger;
}

/**
 * Marks a request (or anything else with a child logger) as acting for a staff member: later
 * lines carry `staff_id`, and the active span gets `riviera.staff_id` (FR-004). Only the
 * pseudonymous ID is accepted; the error never repeats the rejected value, which may be an
 * email address.
 */
export function withStaff(target: StaffTarget, staffId: string): void {
  if (!isStaffId(staffId)) {
    throw new TypeError("withStaff: not a pseudonymous staff ID");
  }
  target.log = target.log.child({ staff_id: staffId });
  trace.getActiveSpan()?.setAttribute("riviera.staff_id", staffId);
}
