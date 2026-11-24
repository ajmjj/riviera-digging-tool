import { createInstruments } from "@riviera/telemetry/instruments";
import { REDACTED } from "@riviera/telemetry/redact";
import {
  memoryExporters,
  startTestTelemetry,
  type MemoryExporters,
} from "@riviera/telemetry/testing";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildApp } from "../../src/app.ts";
import { Secret } from "../../src/config.ts";
import { withStaff } from "../../src/http/request-context.ts";
import { createQueue } from "../../src/jobs/queue.ts";
import { createRunner } from "../../src/jobs/runner.ts";
import { loadMigrations, migrateUp } from "../../src/migrate.ts";
import { startService, type Service } from "../../src/startup.ts";
import { freshDatabase, type FreshDatabase } from "./fresh-database.ts";

// End-to-end redaction suite (tasks.md T019, SC-005): requests and jobs carry planted emails,
// tokens, cookies and secrets in headers, query, body, job payload, staff context and thrown
// errors; stdout, the exported spans and the exported log records must hold none of them.
// Every planted value is built at runtime, so no secret-shaped literal is committed.

const join = (...parts: string[]): string => parts.join("");
const EMAIL = ["dig.planted", "example.org"].join("@");
const TOKEN = join("tokPLANTED", "9f8e7d6c5b4a");
const COOKIE = join("ckPLANTED", "1a2b3c4d");
const SECRET = join("secPLANTED", "77aa88bb");
const DEV_KEY = ["cg", "dev", "keyPLANTED"].join("-");
const PLANTED = [EMAIL, TOKEN, COOKIE, SECRET, DEV_KEY];
const STAFF = "staff_test_0001";

// 001/FR-005 and research R4 (the authority): every secret word, as a whole word under each
// case and separator, the three substrings, and every run-together compound.
const WORDS =
  "password passwd pass secret token key apikey auth authorization cookie session credential credentials";
const COMPOUNDS =
  "adminkey apikey accesskey privatekey secretkey signingkey encryptionkey masterkey clientkey " +
  "sharedkey sessionkey sessionid authkey authheader setcookie passwd credential authorization";
const cap = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);
const SECRET_NAMES = [
  ...WORDS.split(" ").flatMap((w) => [`app_${w}`, `app${cap(w)}`, `APP-${w.toUpperCase()}`]),
  ...["adminKey", "admin_key", "Admin-Key", "ADMIN_KEY", "X-Api-Key"],
  ...["accesstoken", "clientsecret", "userpasswordhash"],
  ...COMPOUNDS.split(" ").flatMap((c) => [c, c.toUpperCase()]),
];
const SECRET_FIELDS = Object.fromEntries(SECRET_NAMES.map((n, i) => [n, `${SECRET}${String(i)}`]));
const PLAIN = { keyboard: "plain-keyboard", monkey: "plain-monkey" };

type Spans = ReturnType<MemoryExporters["spans"]>;
type Logs = ReturnType<MemoryExporters["logs"]>;

const logLine = z.record(z.string(), z.unknown());
const SHOP = { data: { config: { shopName: "Riviera Records (mock)" } } };

let db: FreshDatabase;
let stdout: string[];

beforeEach(async () => {
  db = await freshDatabase();
  stdout = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => stdout.push(String(chunk)) > 0);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.drop();
});

const lines = () => stdout.map((line) => logLine.parse(JSON.parse(line)));

/** Everything that left the process: stdout, span data after the export guard, log records. */
function emitted(spans: Spans, logs: Logs): string {
  const spanData = spans.map((s) => ({
    name: s.name,
    attributes: s.attributes,
    status: s.status,
    events: s.events.map((e) => ({ name: e.name, attributes: e.attributes })),
    links: s.links.map((l) => l.attributes),
  }));
  const logData = logs.map((l) => ({ body: l.body, attributes: l.attributes }));
  return stdout.join("") + JSON.stringify([spanData, logData]);
}

function expectNothingPlanted(text: string): void {
  for (const value of PLANTED) expect(text).not.toContain(value);
  expect(text).toContain(REDACTED);
}

/** Every value under a key naming staff, at any depth, of every parsed line or attribute set. */
function staffIdentities(values: readonly unknown[]): Set<unknown> {
  const found = new Set<unknown>();
  const walk = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    for (const [key, item] of Object.entries(value)) {
      if (/staff/i.test(key)) found.add(item);
      walk(item);
    }
  };
  values.forEach(walk);
  return found;
}

describe("001/FR-032: the sample request on the real startup path", () => {
  let service: Service | undefined;
  afterEach(async () => {
    await service?.stop();
    service = undefined;
  });

  it("001/FR-005 001/FR-032: headers, query string, body and upstream error bodies", async () => {
    const memory = memoryExporters();
    let calls = 0;
    // Common Ground fails once with an error body echoing the planted values, then answers.
    const fake: typeof fetch = () => {
      calls += 1;
      const echo = { error: `denied ${EMAIL}`, authorization: `Bearer ${TOKEN}`, key: DEV_KEY };
      return Promise.resolve(
        calls === 1 ? Response.json(echo, { status: 500 }) : Response.json(SHOP),
      );
    };
    service = await startService(
      {
        role: "api",
        port: 0,
        databaseUrl: db.url,
        appUrl: new URL("http://localhost"),
        logLevel: "info",
        telemetry: { environment: "ci" },
        sampleFlows: {
          enabled: true,
          commonGroundUrl: new URL("http://mocks:4000"),
          discogsUrl: new URL("http://mocks:4000"),
          commonGroundDevApiKey: new Secret(DEV_KEY),
        },
      },
      new EventEmitter(),
      { exporters: [memory.exporters], fetch: fake },
    );
    const headers = {
      authorization: `Bearer ${TOKEN}`,
      cookie: `session=${COOKIE}; theme=dark`,
      "x-api-key": SECRET,
      "x-request-id": EMAIL,
      "user-agent": `probe/1.0 (${EMAIL})`,
    };
    const url = `/sample/trace?token=${TOKEN}&code=${SECRET}&page=2`;
    const app = service.app;
    const send = (payload: string) =>
      app.inject({
        method: "POST",
        url,
        headers: { ...headers, "content-type": "application/json" },
        payload,
      });
    expect((await send(JSON.stringify({ releaseId: 7 }))).statusCode).toBe(502);
    expect((await send(JSON.stringify({ releaseId: 7 }))).statusCode).toBe(202);
    const body = JSON.stringify({ password: SECRET, owner: EMAIL, cookie: COOKIE });
    expect((await send(body)).statusCode).toBe(400);
    expect((await send(`Bearer ${TOKEN} token=${TOKEN} ${EMAIL}`)).statusCode).toBe(400);
    await service.stop();

    expectNothingPlanted(emitted(memory.spans(), memory.logs()));
    // R4 header allow-list: only user-agent and content-type are logged, and redacted too.
    const incoming = lines().filter((l) => l["msg"] === "incoming request");
    expect(incoming).toHaveLength(4);
    for (const { req } of incoming) {
      expect(req).toEqual({
        method: "POST",
        url: `/sample/trace?token=${REDACTED}&code=${REDACTED}&page=2`,
        headers: { "user-agent": `probe/1.0 (${REDACTED})`, "content-type": "application/json" },
      });
    }
    // An invalid X-Request-Id is replaced, never echoed.
    expect(new Set(lines().map((l) => l["request_id"]))).not.toContain(EMAIL);
  });
});

describe("001/FR-032: staff context, secret-named fields, job payloads and thrown errors", () => {
  it("001/FR-004 001/FR-005 001/FR-032: a staff request and staff jobs leak nothing", async () => {
    await migrateUp(db.url, await loadMigrations());
    const harness = startTestTelemetry();
    const meter = harness.telemetry.meterProvider.getMeter("test");
    const instruments = createInstruments(meter, { routes: [] });
    const app = buildApp({
      logger: { service: "riviera-api", env: "ci", level: "info" },
      pingDatabase: () => Promise.resolve(),
      telemetry: { tracer: harness.telemetry.tracerProvider.getTracer("test"), meter },
    });
    // A probe route on the real app: it acts for a staff member, logs the body and the planted
    // fields, sets them as span attributes, then throws an error quoting secrets.
    app.post("/probe", (request, reply) => {
      withStaff(request, STAFF, reply);
      request.log.info({ body: request.body, fields: { ...SECRET_FIELDS, ...PLAIN } }, "probe");
      const span = harness.telemetry.tracerProvider.getTracer("probe").startSpan("probe");
      for (const [name, value] of Object.entries({ ...SECRET_FIELDS, ...PLAIN })) {
        span.setAttribute(`probe.${name}`, value);
      }
      span.end();
      throw new Error(
        `probe failed for ${EMAIL}: Authorization: Bearer ${TOKEN}; password=${SECRET}`,
      );
    });
    const res = await app.inject({
      method: "POST",
      url: "/probe",
      payload: { ...SECRET_FIELDS, contact: EMAIL, note: `Discogs token=${TOKEN}`, ...PLAIN },
    });
    expect(res.statusCode).toBe(500);

    // Jobs for the staff member: one whose handler throws a message quoting secrets, and one
    // stored with a planted payload that fails validation before any handler runs.
    const queue = createQueue({ db, instruments });
    const thrown = await queue.enqueue(
      "sample.discogs_release",
      { releaseId: 7, fail: true },
      { maxAttempts: 1, staffId: STAFF },
    );
    const planted = { releaseId: 7, fail: false, password: SECRET, owner: EMAIL, session: COOKIE };
    await db.query(
      "INSERT INTO job (name, payload, max_attempts, staff_id) VALUES ($1, $2, 1, $3)",
      ["sample.discogs_release", planted, STAFF],
    );
    const runner = createRunner({
      queue,
      instruments,
      log: app.log,
      idleMs: 10,
      handlers: {
        "sample.discogs_release": (_payload, run) => {
          run.log.warn(
            { upstream: { authorization: `Bearer ${TOKEN}`, contact: EMAIL } },
            "probe job",
          );
          return Promise.reject(new Error(`upstream rejected ${EMAIL} with cookie=${COOKIE}`));
        },
      },
    });
    runner.start();
    await vi.waitFor(async () => {
      const failed = await db.query("SELECT id FROM job WHERE status = 'failed'");
      expect(failed.rows).toHaveLength(2);
    });
    await runner.stop();
    await app.close();

    const jobs = (await db.query("SELECT id, staff_id, last_error FROM job ORDER BY id")).rows;
    const spans = await harness.spans();
    const logs = await harness.logs();
    await harness.shutdown();
    const errors = JSON.stringify(jobs.map((j) => j["last_error"]));
    expectNothingPlanted(emitted(spans, logs) + errors);
    expect(jobs.find((j) => j["id"] === thrown.id)?.["last_error"]).toContain(REDACTED);

    // Secret-named fields are redacted under every name; keyboard and monkey are kept.
    const probe = lines().find((l) => l["msg"] === "probe");
    const redactedFields = Object.fromEntries(SECRET_NAMES.map((n) => [n, REDACTED]));
    expect(probe?.["fields"]).toEqual({ ...redactedFields, ...PLAIN });
    const attributes = spans.find((s) => s.name === "probe")?.attributes;
    const prefixed = (o: object) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [`probe.${k}`, v]));
    expect(attributes).toEqual({ ...prefixed(redactedFields), ...prefixed(PLAIN) });

    // The only staff identity anywhere is the pseudonymous test ID.
    const identities = staffIdentities([
      ...lines(),
      ...spans.map((s) => s.attributes),
      ...logs.map((l) => l.attributes),
      ...jobs,
    ]);
    expect(identities).toEqual(new Set([STAFF]));
    expect(spans.some((s) => s.attributes["riviera.staff_id"] === STAFF)).toBe(true);
  });
});
