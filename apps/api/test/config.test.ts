import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { type Env, loadConfig, Secret } from "../src/config.ts";

// Settings every environment needs; `base` adds what production requires (002/FR-036).
const common = {
  APP_URL: "http://localhost:8080",
  DATABASE_URL: "postgres://u:p@db/riviera",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
};
const base = {
  ...common,
  SMTP_URL: "smtps://dig%40rivierarecords.de:smtp-pass@smtp.ionos.de:465",
  EMAIL_FROM: "dig@rivierarecords.de",
};

describe("loadConfig", () => {
  it("defaults the api to port 3000 and log level info", () => {
    const { sessionSecret, apiAuth, ...config } = loadConfig(base, "api");
    expect(config).toEqual({
      role: "api",
      port: 3000,
      databaseUrl: base.DATABASE_URL,
      appUrl: new URL("http://localhost:8080"),
      logLevel: "info",
      telemetry: { endpoint: undefined, environment: "production" },
      sampleFlows: { enabled: false },
    });
    expect(sessionSecret).toBeInstanceOf(Secret);
    expect(apiAuth).toMatchObject({
      emailFrom: "dig@rivierarecords.de",
      emailTransport: { kind: "smtp", host: "smtp.ionos.de", port: 465, secure: true },
      initialAdmin: undefined,
    });
  });

  it("defaults the worker to port 3001 and reads WORKER_PORT, not PORT", () => {
    expect(loadConfig({ ...base, PORT: "9999" }, "worker").port).toBe(3001);
    expect(loadConfig({ ...base, WORKER_PORT: "4001" }, "worker").port).toBe(4001);
  });

  it("reads PORT for the api", () => {
    expect(loadConfig({ ...base, PORT: "4000" }, "api").port).toBe(4000);
  });

  it.each([["0"], ["65536"], ["abc"], ["30.5"], ["-1"], [""]])("rejects port %j", (port) => {
    expect(() => loadConfig({ ...base, PORT: port }, "api")).toThrow(/PORT/);
  });

  it("accepts the port boundaries 1 and 65535", () => {
    expect(loadConfig({ ...base, PORT: "1" }, "api").port).toBe(1);
    expect(loadConfig({ ...base, PORT: "65535" }, "api").port).toBe(65_535);
  });

  it.each([[undefined], ["web"], [""]])("rejects role %j", (role) => {
    expect(() => loadConfig(base, role)).toThrow(/Role must be/);
  });

  it.each([["APP_URL"], ["DATABASE_URL"]])("requires %s", (name) => {
    expect(() => loadConfig({ ...base, [name]: undefined }, "api")).toThrow(
      `Missing required environment variable ${name}`,
    );
    expect(() => loadConfig({ ...base, [name]: "  " }, "api")).toThrow(name);
  });

  it("rejects a relative APP_URL", () => {
    expect(() => loadConfig({ ...base, APP_URL: "/dig" }, "api")).toThrow(/absolute URL/);
  });

  it("accepts every known log level and rejects others", () => {
    for (const level of ["fatal", "error", "warn", "info", "debug", "trace", "silent"]) {
      expect(loadConfig({ ...base, LOG_LEVEL: level }, "api").logLevel).toBe(level);
    }
    expect(() => loadConfig({ ...base, LOG_LEVEL: "loud" }, "api")).toThrow(/LOG_LEVEL/);
  });
});

const dev = { ...common, DEPLOYMENT_ENVIRONMENT: "development" };
const mocks = { COMMON_GROUND_URL: "http://mocks:4000", DISCOGS_URL: "http://mocks:4000" };
const flagOn = { SAMPLE_FLOWS_ENABLED: "true", ...mocks };

describe("001/FR-019: telemetry endpoint", () => {
  it.each([[undefined], [""], ["  "]])("001/FR-019: endpoint %j turns export off", (value) => {
    const config = loadConfig({ ...base, OTEL_EXPORTER_OTLP_ENDPOINT: value }, "api");
    expect(config.telemetry.endpoint).toBeUndefined();
  });

  it("001/FR-019: reads the collector endpoint as a URL", () => {
    const config = loadConfig(
      { ...base, OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-collector:4318" },
      "worker",
    );
    expect(config.telemetry.endpoint).toEqual(new URL("http://otel-collector:4318"));
  });

  it.each([["otel-collector:4318x"], ["/v1/traces"], ["ftp://collector:4318"]])(
    "001/FR-019: rejects endpoint %j",
    (value) => {
      expect(() => loadConfig({ ...base, OTEL_EXPORTER_OTLP_ENDPOINT: value }, "api")).toThrow(
        /OTEL_EXPORTER_OTLP_ENDPOINT must be an (absolute|http or https) URL/,
      );
    },
  );
});

describe("001/FR-027: deployment environment and the sample-flow flag", () => {
  it.each([[undefined], [""], ["production"]])(
    "001/FR-027: environment %j means production",
    (value) => {
      expect(loadConfig({ ...base, DEPLOYMENT_ENVIRONMENT: value }, "api").telemetry).toEqual({
        endpoint: undefined,
        environment: "production",
      });
    },
  );

  it.each([["development"], ["ci"]])("001/FR-027: reads environment %s", (value) => {
    const config = loadConfig({ ...common, DEPLOYMENT_ENVIRONMENT: value }, "api");
    expect(config.telemetry.environment).toBe(value);
  });

  it.each([["staging"], ["Production"], ["dev"]])("001/FR-027: rejects environment %j", (value) => {
    expect(() => loadConfig({ ...base, DEPLOYMENT_ENVIRONMENT: value }, "api")).toThrow(
      `DEPLOYMENT_ENVIRONMENT must be development, ci or production, got "${value}"`,
    );
  });

  it.each([[undefined], [""], ["false"]])("001/FR-027: flag %j leaves sample flows off", (flag) => {
    const config = loadConfig({ ...dev, ...mocks, SAMPLE_FLOWS_ENABLED: flag }, "api");
    expect(config.sampleFlows).toEqual({ enabled: false });
  });

  it.each([["1"], ["yes"], ["TRUE"]])("001/FR-027: rejects flag %j", (flag) => {
    expect(() => loadConfig({ ...dev, SAMPLE_FLOWS_ENABLED: flag }, "api")).toThrow(
      `SAMPLE_FLOWS_ENABLED must be "true" or "false", got "${flag}"`,
    );
  });

  it.each([[undefined], [""], ["production"]])(
    "001/FR-027: flag on with environment %j refuses to start",
    (environment) => {
      for (const role of ["api", "worker"]) {
        expect(() =>
          loadConfig({ ...base, ...flagOn, DEPLOYMENT_ENVIRONMENT: environment }, role),
        ).toThrow(
          "SAMPLE_FLOWS_ENABLED=true needs DEPLOYMENT_ENVIRONMENT set explicitly to development or ci",
        );
      }
    },
  );

  it.each([["development"], ["ci"]])("001/FR-027: flag on in %s starts", (environment) => {
    const config = loadConfig({ ...common, ...flagOn, DEPLOYMENT_ENVIRONMENT: environment }, "api");
    expect(config.sampleFlows).toEqual({
      enabled: true,
      commonGroundUrl: new URL("http://mocks:4000"),
      discogsUrl: new URL("http://mocks:4000"),
      commonGroundDevApiKey: undefined,
    });
  });
});

describe("001/FR-013: mock URLs only", () => {
  it.each([["COMMON_GROUND_URL"], ["DISCOGS_URL"]])(
    "001/FR-013: %s is required when the flag is on",
    (name) => {
      for (const value of [undefined, "", " "]) {
        expect(() => loadConfig({ ...dev, ...flagOn, [name]: value }, "api")).toThrow(
          `${name} is required when SAMPLE_FLOWS_ENABLED=true`,
        );
      }
    },
  );

  it("001/FR-013: mock URLs are not needed or read when the flag is off", () => {
    const config = loadConfig({ ...dev, DISCOGS_URL: "https://api.discogs.com" }, "api");
    expect(config.sampleFlows).toEqual({ enabled: false });
  });

  it.each([
    ["https://discogs.com"],
    ["https://api.discogs.com/releases/1"],
    ["http://DISCOGS.COM."],
    ["https://www.Discogs.com:443"],
  ])("001/FR-013: refuses Discogs URL %s", (url) => {
    for (const name of ["COMMON_GROUND_URL", "DISCOGS_URL"]) {
      expect(() => loadConfig({ ...dev, ...flagOn, [name]: url }, "api")).toThrow(
        `${name} must point at the local mock, never discogs.com`,
      );
    }
  });

  it.each([
    ["https://api-admin.common-ground.io/graphql"],
    ["https://riviera-records.common-ground.io/graphql"],
    ["https://common-ground.io"],
    ["http://API-ADMIN.Common-Ground.IO.:443/graphql"],
  ])("001/FR-013: refuses Common Ground URL %s", (url) => {
    for (const name of ["COMMON_GROUND_URL", "DISCOGS_URL"]) {
      expect(() => loadConfig({ ...dev, ...flagOn, [name]: url }, "api")).toThrow(
        `${name} must point at the local mock, never common-ground.io`,
      );
    }
  });

  it.each([
    ["https://api.example.com/graphql"],
    ["https://notdiscogs.com"],
    ["https://notcommon-ground.io"],
    ["http://8.8.8.8:4000"],
    ["http://172.15.0.1"],
    ["http://172.32.0.1"],
    ["http://192.169.0.1"],
    ["http://11.0.0.1"],
    ["http://[2001:db8::1]:4000"],
  ])("001/FR-013: refuses public host %s", (url) => {
    for (const name of ["COMMON_GROUND_URL", "DISCOGS_URL"]) {
      expect(() => loadConfig({ ...dev, ...flagOn, [name]: url }, "api")).toThrow(
        `${name} must point at the local mock, not a public host`,
      );
    }
  });

  it.each([
    ["http://mocks:4000"],
    ["http://mocks.:4000"],
    ["http://localhost:4000"],
    ["http://mocks.localhost"],
    ["http://127.0.0.1:4000"],
    ["http://10.1.2.3"],
    ["http://172.16.0.1"],
    ["http://172.31.255.1"],
    ["http://192.168.1.10"],
    ["http://[::1]:4000"],
  ])("001/FR-013: accepts local mock URL %s", (url) => {
    const config = loadConfig(
      { ...dev, ...flagOn, COMMON_GROUND_URL: url, DISCOGS_URL: url },
      "api",
    );
    expect(config.sampleFlows).toMatchObject({
      commonGroundUrl: new URL(url),
      discogsUrl: new URL(url),
    });
  });

  it.each([["mocks:4000"], ["file:///etc/passwd"]])("001/FR-013: rejects mock URL %j", (url) => {
    expect(() => loadConfig({ ...dev, ...flagOn, DISCOGS_URL: url }, "api")).toThrow(
      /DISCOGS_URL must be/,
    );
  });
});

describe("001/FR-013: Common Ground mock credential", () => {
  it("001/FR-013: COMMON_GROUND_DEV_API_KEY is read, and redacted when printed", () => {
    const config = loadConfig({ ...dev, ...flagOn, COMMON_GROUND_DEV_API_KEY: "dev-key-1" }, "api");
    if (!config.sampleFlows.enabled) {
      throw new Error("sample flows should be on");
    }
    const key = config.sampleFlows.commonGroundDevApiKey;
    expect(key?.reveal()).toBe("dev-key-1");
    expect(String(key)).toBe("[redacted]");
    expect(JSON.stringify(config)).not.toContain("dev-key-1");
    expect(JSON.stringify(config)).toContain('"commonGroundDevApiKey":"[redacted]"');
    expect(inspect(config, { depth: 5 })).not.toContain("dev-key-1");
    expect(inspect(key)).toBe("[redacted]");
  });

  it("001/FR-013: an empty COMMON_GROUND_DEV_API_KEY counts as unset", () => {
    const config = loadConfig({ ...dev, ...flagOn, COMMON_GROUND_DEV_API_KEY: "" }, "api");
    expect(config.sampleFlows).toMatchObject({ commonGroundDevApiKey: undefined });
  });
});

// Every refusal names the setting and never prints the value planted in it (002/FR-036).
const PLANTED = "planted-Zq7x";

function expectRefusal(env: Env, expected: string | RegExp, role = "api"): void {
  let message = "";
  try {
    loadConfig(env, role);
  } catch (error) {
    message = error instanceof Error ? error.message : "not an Error";
  }
  expect(message).toMatch(expected);
  expect(message).not.toContain(PLANTED);
}

const ci = { ...common, DEPLOYMENT_ENVIRONMENT: "ci" };

describe("002/FR-036: session secret", () => {
  it.each([
    ["production", base],
    ["development", dev],
    ["ci", ci],
  ])("002/FR-036: %s refuses a missing or short SESSION_SECRET", (_name, env) => {
    for (const value of [undefined, "", "   ", PLANTED + "x".repeat(31 - PLANTED.length)]) {
      for (const role of ["api", "worker"]) {
        expectRefusal(
          { ...env, SESSION_SECRET: value },
          /^SESSION_SECRET is missing or shorter than 32 bytes$/,
          role,
        );
      }
    }
  });

  it("002/FR-036: counts UTF-8 bytes, not characters", () => {
    const config = loadConfig({ ...base, SESSION_SECRET: "é".repeat(16) }, "worker");
    expect(config.sessionSecret.reveal()).toBe("é".repeat(16));
    expectRefusal({ ...base, SESSION_SECRET: "é".repeat(15) + "x" }, /^SESSION_SECRET is missing/);
  });

  it("002/FR-036: production refuses the dev-only placeholder, for api and worker", () => {
    for (const role of ["api", "worker"]) {
      const env = { ...base, SESSION_SECRET: `dev-only-${PLANTED}-0000000000000000000000` };
      expectRefusal(
        env,
        /^SESSION_SECRET must not be the dev-only placeholder in production$/,
        role,
      );
    }
  });

  it.each([["development"], ["ci"]])("002/FR-036: %s accepts the dev-only placeholder", (name) => {
    const placeholder = "dev-only-session-secret-0000000000000000";
    const env = { ...common, DEPLOYMENT_ENVIRONMENT: name, SESSION_SECRET: placeholder };
    expect(loadConfig(env, "worker").sessionSecret.reveal()).toBe(placeholder);
  });
});

describe("002/FR-036: production APP_URL", () => {
  it.each([
    [`http://${PLANTED}.example.com`],
    [`http://${PLANTED}.localhost:8080`],
    [`ftp://${PLANTED}.de`],
  ])("002/FR-036: refuses %s", (url) => {
    expectRefusal(
      { ...base, APP_URL: url },
      /^APP_URL must use https in production, or http only on localhost or 127\.0\.0\.1$/,
    );
  });

  it.each([["https://dig.rivierarecords.de"], ["http://localhost:8080"], ["http://127.0.0.1"]])(
    "002/FR-036: accepts %s",
    (url) => {
      expect(loadConfig({ ...base, APP_URL: url }, "api").appUrl).toEqual(new URL(url));
    },
  );

  it("002/FR-036: development accepts plain http on any host", () => {
    const config = loadConfig({ ...dev, APP_URL: "http://dig.example.com" }, "api");
    expect(config.appUrl.hostname).toBe("dig.example.com");
  });
});

describe("002/FR-036, 002/FR-038: SMTP_URL", () => {
  it.each([[undefined], [""], [" "]])("002/FR-036: production requires SMTP_URL (%j)", (v) => {
    expectRefusal({ ...base, SMTP_URL: v }, /^SMTP_URL is required in production$/);
  });

  it.each([
    [`smtps://u:${PLANTED}@smtp.ionos.de.evil.example:465`, /^SMTP_URL must name an allowed host/],
    [`smtps://u:${PLANTED}@smtp.gmail.com:465`, /^SMTP_URL must name an allowed host/],
    [`https://u:${PLANTED}@smtp.ionos.de`, /^SMTP_URL must be an smtp: or smtps: URL$/],
    [`${PLANTED} not a url`, /^SMTP_URL must be an smtp: or smtps: URL$/],
    [`smtps://${PLANTED}@smtp.ionos.de:465`, /^SMTP_URL must include a user name and password$/],
    [`smtps://:${PLANTED}@smtp.ionos.de:465`, /^SMTP_URL must include a user name and password$/],
    [`smtps://u:%zz${PLANTED}@smtp.ionos.de`, /^SMTP_URL has a malformed user name or password$/],
  ])("002/FR-036: refuses SMTP_URL %#", (url, expected) => {
    expectRefusal({ ...base, SMTP_URL: url }, expected);
  });

  it.each([
    ["smtps://u:p@smtp.ionos.de:465", "smtp.ionos.de", 465, true],
    ["smtps://u:p@SMTP.IONOS.COM", "smtp.ionos.com", 465, true],
    ["smtp://u:p@smtp.ionos.de:587", "smtp.ionos.de", 587, false],
    ["smtp://u:p@smtp.ionos.com", "smtp.ionos.com", 587, false],
  ])("002/FR-037: accepts %s", (url, host, port, secure) => {
    const transport = loadConfig({ ...base, SMTP_URL: url }, "api").apiAuth?.emailTransport;
    expect(transport).toMatchObject({ kind: "smtp", host, port, secure, requireTLS: true });
  });

  it("002/FR-036: keeps the secret and decoded SMTP credentials redacted", () => {
    const config = loadConfig(base, "api");
    const transport = config.apiAuth?.emailTransport;
    if (transport?.kind !== "smtp") {
      throw new Error("expected the SMTP transport");
    }
    expect(transport.user.reveal()).toBe("dig@rivierarecords.de");
    expect(transport.password.reveal()).toBe("smtp-pass");
    for (const text of [JSON.stringify(config), inspect(config, { depth: 6 })]) {
      expect(text).not.toContain(common.SESSION_SECRET);
      expect(text).not.toContain("smtp-pass");
    }
  });

  it.each([["development"], ["ci"]])("002/FR-038: %s refuses any SMTP_URL", (environment) => {
    for (const url of [base.SMTP_URL, `smtps://u:${PLANTED}@smtp.ionos.de`, PLANTED]) {
      const env = { ...common, DEPLOYMENT_ENVIRONMENT: environment, SMTP_URL: url };
      expectRefusal(env, /^SMTP_URL is set but DEPLOYMENT_ENVIRONMENT is not production$/);
    }
  });

  it("002/FR-037: the worker needs no email settings in production", () => {
    expect(loadConfig(common, "worker").apiAuth).toBeUndefined();
  });
});

describe("002/FR-037: EMAIL_FROM and EMAIL_CAPTURE_DIR", () => {
  it.each([
    [undefined],
    [`${PLANTED}@gmail.com`],
    [`${PLANTED}@mail.rivierarecords.de`],
    [`${PLANTED}@rivierarecords.de.example`],
    [`${PLANTED}@notrivierarecords.de`],
    [PLANTED],
    [`${PLANTED} x@rivierarecords.de`],
    ["@rivierarecords.de"],
  ])("002/FR-037: production refuses EMAIL_FROM %j", (from) => {
    expectRefusal(
      { ...base, EMAIL_FROM: from },
      /^EMAIL_FROM must be an address on rivierarecords\.de$/,
    );
  });

  it.each([["dig@rivierarecords.de"], ["Dig@RivieraRecords.DE"]])(
    "002/FR-037: production accepts EMAIL_FROM %s",
    (from) => {
      expect(loadConfig({ ...base, EMAIL_FROM: from }, "api").apiAuth?.emailFrom).toBe(from);
    },
  );

  it("002/FR-037: development defaults EMAIL_FROM and captures in memory", () => {
    expect(loadConfig(dev, "api").apiAuth).toEqual({
      emailFrom: "dev-capture@localhost.invalid",
      emailTransport: { kind: "capture", dir: undefined },
      initialAdmin: undefined,
    });
  });

  it("002/FR-037: development accepts EMAIL_FROM on any domain", () => {
    const from = loadConfig({ ...dev, EMAIL_FROM: "me@example.com" }, "api").apiAuth?.emailFrom;
    expect(from).toBe("me@example.com");
  });

  it.each([
    ["development", dev],
    ["ci", ci],
  ])("002/FR-037: %s reads EMAIL_CAPTURE_DIR", (_name, env) => {
    const config = loadConfig({ ...env, EMAIL_CAPTURE_DIR: "/var/lib/riviera/mail" }, "api");
    expect(config.apiAuth?.emailTransport).toEqual({
      kind: "capture",
      dir: "/var/lib/riviera/mail",
    });
  });

  it("002/FR-038: production refuses EMAIL_CAPTURE_DIR", () => {
    const env = { ...base, EMAIL_CAPTURE_DIR: `/tmp/${PLANTED}` };
    expectRefusal(env, /^EMAIL_CAPTURE_DIR is set but DEPLOYMENT_ENVIRONMENT is production$/);
  });
});

describe("002/FR-033: first admin settings", () => {
  it("002/FR-033: both are optional", () => {
    expect(loadConfig(base, "api").apiAuth?.initialAdmin).toBeUndefined();
  });

  it("002/FR-033: reads the address and the name, trimmed; the name is optional", () => {
    const admin = (name: string | undefined): unknown =>
      loadConfig({ ...base, INITIAL_ADMIN_EMAIL: " a@b.invalid ", INITIAL_ADMIN_NAME: name }, "api")
        .apiAuth?.initialAdmin;
    expect(admin(" Antn ")).toEqual({ email: "a@b.invalid", name: "Antn" });
    expect(admin(undefined)).toEqual({ email: "a@b.invalid", name: undefined });
    // The 1-character minimum: an empty or whitespace-only name counts as unset (R8).
    expect(admin("")).toEqual({ email: "a@b.invalid", name: undefined });
    expect(admin("   ")).toEqual({ email: "a@b.invalid", name: undefined });
    expect(admin("é".repeat(80))).toEqual({ email: "a@b.invalid", name: "é".repeat(80) });
    expect(admin("👩‍👩‍👧".repeat(80))).toMatchObject({ name: "👩‍👩‍👧".repeat(80) });
  });

  it.each([[PLANTED], [`${PLANTED}@`], [`a b@${PLANTED}.de`], [`${PLANTED}@localhost`]])(
    "002/FR-033: refuses INITIAL_ADMIN_EMAIL %j",
    (email) => {
      expectRefusal(
        { ...dev, INITIAL_ADMIN_EMAIL: email },
        /^INITIAL_ADMIN_EMAIL must be an email address$/,
      );
    },
  );

  it("002/FR-033: refuses an INITIAL_ADMIN_NAME over 80 characters", () => {
    const env = {
      ...base,
      INITIAL_ADMIN_EMAIL: "a@b.invalid",
      INITIAL_ADMIN_NAME: PLANTED + "x".repeat(81 - PLANTED.length),
    };
    expectRefusal(env, /^INITIAL_ADMIN_NAME must be 1 to 80 characters$/);
  });
});
