type Role = "api" | "worker";

export interface Config {
  readonly role: Role;
  readonly port: number;
  readonly databaseUrl: string;
  readonly appUrl: URL;
  readonly logLevel: string;
}

type DeploymentEnvironment = "development" | "ci" | "production";

/** A secret that never shows up when the config is logged, printed or serialised. */
class Secret {
  readonly #value: string;
  constructor(value: string) {
    this.#value = value;
  }
  reveal(): string {
    return this.#value;
  }
  toString(): string {
    return "[redacted]";
  }
  toJSON(): string {
    return "[redacted]";
  }
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return "[redacted]";
  }
}

type SampleFlows =
  | { readonly enabled: false }
  | {
      readonly enabled: true;
      readonly commonGroundUrl: URL;
      readonly discogsUrl: URL;
      /** Dev-only credential for the Common Ground mock's Authorization header. */
      readonly commonGroundDevApiKey: Secret | undefined;
    };

interface LoadedConfig extends Config {
  readonly telemetry: {
    /** OTLP/HTTP collector base URL; undefined turns telemetry export off (FR-019). */
    readonly endpoint: URL | undefined;
    readonly environment: DeploymentEnvironment;
  };
  readonly sampleFlows: SampleFlows;
}

export type Env = Readonly<Record<string, string | undefined>>;

const LOG_LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

function required(env: Env, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

/** Reads an optional variable; an empty or blank value counts as unset. */
function optional(env: Env, name: string): string | undefined {
  const value = env[name];
  return value === undefined || value.trim() === "" ? undefined : value;
}

function parseHttpUrl(raw: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute URL, got "${raw}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must be an http or https URL, got "${raw}"`);
  }
  return url;
}

function parseEnvironment(raw: string | undefined): DeploymentEnvironment {
  // Unset means production, so a forgotten variable fails closed (research R17).
  if (raw === undefined || raw === "production") {
    return "production";
  }
  if (raw === "development" || raw === "ci") {
    return raw;
  }
  throw new Error(`DEPLOYMENT_ENVIRONMENT must be development, ci or production, got "${raw}"`);
}

function parseFlag(raw: string | undefined, name: string): boolean {
  if (raw === undefined || raw === "false") {
    return false;
  }
  if (raw === "true") {
    return true;
  }
  throw new Error(`${name} must be "true" or "false", got "${raw}"`);
}

const REAL_DOMAINS = ["discogs.com", "common-ground.io"];

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Loopback or private-range IPv4, i.e. never a public address. */
function isLocalIpv4(host: string): boolean {
  const [a, b] = host.split(".").map(Number);
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * The sample flows may only reach the local mocks (research R16, FR-013). The real hosts are
 * refused by name: discogs.com and common-ground.io (the Admin API at api-admin.common-ground.io,
 * the Client API at riviera-records.common-ground.io), with their subdomains. As a backstop every
 * other public host is refused too: a mock URL must be a single-label name (the compose service
 * `mocks`), localhost, or a loopback or private address.
 */
function parseMockUrl(env: Env, name: string): URL {
  const raw = optional(env, name);
  if (raw === undefined) {
    throw new Error(`${name} is required when SAMPLE_FLOWS_ENABLED=true`);
  }
  const url = parseHttpUrl(raw, name);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  for (const real of REAL_DOMAINS) {
    if (host === real || host.endsWith(`.${real}`)) {
      throw new Error(`${name} must point at the local mock, never ${real} (got ${host})`);
    }
  }
  const local =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    (IPV4.test(host) ? isLocalIpv4(host) : !host.includes(".") && !host.startsWith("["));
  if (!local) {
    throw new Error(`${name} must point at the local mock, not a public host (got ${host})`);
  }
  return url;
}

function parseSampleFlows(env: Env, environment: DeploymentEnvironment): SampleFlows {
  if (!parseFlag(optional(env, "SAMPLE_FLOWS_ENABLED"), "SAMPLE_FLOWS_ENABLED")) {
    return { enabled: false };
  }
  // The sample route is unauthenticated, so it must never be live on the host (R17).
  if (environment === "production") {
    throw new Error(
      "SAMPLE_FLOWS_ENABLED=true needs DEPLOYMENT_ENVIRONMENT set explicitly to development or ci",
    );
  }
  const devKey = optional(env, "COMMON_GROUND_DEV_API_KEY");
  return {
    enabled: true,
    commonGroundUrl: parseMockUrl(env, "COMMON_GROUND_URL"),
    discogsUrl: parseMockUrl(env, "DISCOGS_URL"),
    commonGroundDevApiKey: devKey === undefined ? undefined : new Secret(devKey),
  };
}

function parsePort(raw: string, name: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a whole number, got "${raw}"`);
  }
  const port = Number(raw);
  if (port < 1 || port > 65_535) {
    throw new Error(`${name} must be between 1 and 65535, got ${String(port)}`);
  }
  return port;
}

function parseRole(raw: string | undefined): Role {
  if (raw === "api" || raw === "worker") {
    return raw;
  }
  throw new Error(`Role must be "api" or "worker", got "${raw ?? ""}"`);
}

/** Reads and validates the process configuration. Throws on the first problem. */
export function loadConfig(env: Env, roleArg: string | undefined): LoadedConfig {
  const role = parseRole(roleArg);
  const portVar = role === "api" ? "PORT" : "WORKER_PORT";
  const defaultPort = role === "api" ? "3000" : "3001";
  const port = parsePort(env[portVar] ?? defaultPort, portVar);

  const appUrlRaw = required(env, "APP_URL");
  let appUrl: URL;
  try {
    appUrl = new URL(appUrlRaw);
  } catch {
    throw new Error(`APP_URL must be an absolute URL, got "${appUrlRaw}"`);
  }

  const logLevel = env["LOG_LEVEL"] ?? "info";
  if (!LOG_LEVELS.has(logLevel)) {
    throw new Error(`LOG_LEVEL must be one of ${[...LOG_LEVELS].join(", ")}`);
  }

  const endpointRaw = optional(env, "OTEL_EXPORTER_OTLP_ENDPOINT");
  const environment = parseEnvironment(optional(env, "DEPLOYMENT_ENVIRONMENT"));

  return {
    role,
    port,
    databaseUrl: required(env, "DATABASE_URL"),
    appUrl,
    logLevel,
    telemetry: {
      endpoint:
        endpointRaw === undefined
          ? undefined
          : parseHttpUrl(endpointRaw, "OTEL_EXPORTER_OTLP_ENDPOINT"),
      environment,
    },
    sampleFlows: parseSampleFlows(env, environment),
  };
}
