import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

const base = { APP_URL: "http://localhost:8080", DATABASE_URL: "postgres://u:p@db/riviera" };

describe("loadConfig", () => {
  it("defaults the api to port 3000 and log level info", () => {
    const config = loadConfig(base, "api");
    expect(config).toEqual({
      role: "api",
      port: 3000,
      databaseUrl: base.DATABASE_URL,
      appUrl: new URL("http://localhost:8080"),
      logLevel: "info",
      telemetry: { endpoint: undefined, environment: "production" },
      sampleFlows: { enabled: false },
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

const dev = { ...base, DEPLOYMENT_ENVIRONMENT: "development" };
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
    const config = loadConfig({ ...base, DEPLOYMENT_ENVIRONMENT: value }, "api");
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
    const config = loadConfig({ ...base, ...flagOn, DEPLOYMENT_ENVIRONMENT: environment }, "api");
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
    ["https://riviera.common-ground.io/graphql"],
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
