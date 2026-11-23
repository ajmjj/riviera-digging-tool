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
