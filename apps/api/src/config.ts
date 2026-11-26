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
export class Secret {
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

export type SampleFlows =
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
  /** HKDF input for every token key (002 research R4); read by both roles (R8). */
  readonly sessionSecret: Secret;
  /** The api's email and first-admin settings (002 R8); undefined for the worker. */
  readonly apiAuth: ApiAuthConfig | undefined;
}

type EmailTransportConfig =
  | {
      readonly kind: "smtp";
      readonly host: string;
      readonly port: number;
      /** true for smtps: (TLS from the start); smtp: upgrades with STARTTLS. */
      readonly secure: boolean;
      readonly requireTLS: true;
      readonly user: Secret;
      readonly password: Secret;
    }
  | {
      readonly kind: "capture";
      /** Directory for one JSON file per message; undefined keeps captured mail in memory. */
      readonly dir: string | undefined;
    };

interface ApiAuthConfig {
  readonly emailFrom: string;
  readonly emailTransport: EmailTransportConfig;
  readonly initialAdmin: { readonly email: string; readonly name: string | undefined } | undefined;
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

// Research R8: the only SMTP hosts the api may send through. Extend only with a test.
const SMTP_HOSTS = new Set(["smtp.ionos.de", "smtp.ionos.com"]);
const SENDER_DOMAIN = "rivierarecords.de";
const DEV_EMAIL_FROM = "dev-capture@localhost.invalid";
const MIN_SECRET_BYTES = 32;
const MAX_ADMIN_NAME = 80;

// Every refusal below names the setting and never prints its value (contracts/email.md).

/** A plain address: one @, no spaces, a dotted domain. */
function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

function parseSessionSecret(env: Env, environment: DeploymentEnvironment): Secret {
  const raw = optional(env, "SESSION_SECRET");
  if (raw === undefined || Buffer.byteLength(raw, "utf8") < MIN_SECRET_BYTES) {
    throw new Error(`SESSION_SECRET is missing or shorter than ${String(MIN_SECRET_BYTES)} bytes`);
  }
  if (environment === "production" && raw.startsWith("dev-only")) {
    throw new Error("SESSION_SECRET must not be the dev-only placeholder in production");
  }
  return new Secret(raw);
}

/** Production's APP_URL: https, or plain http only on localhost or 127.0.0.1 (002/FR-036). */
function checkProductionAppUrl(appUrl: URL): void {
  const local = appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1";
  if (appUrl.protocol !== "https:" && !(appUrl.protocol === "http:" && local)) {
    throw new Error("APP_URL must use https in production, or http only on localhost or 127.0.0.1");
  }
}

function parseSmtpUrl(raw: string): EmailTransportConfig {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("SMTP_URL must be an smtp: or smtps: URL");
  }
  if (url.protocol !== "smtp:" && url.protocol !== "smtps:") {
    throw new Error("SMTP_URL must be an smtp: or smtps: URL");
  }
  const host = url.hostname.toLowerCase();
  if (!SMTP_HOSTS.has(host)) {
    throw new Error(`SMTP_URL must name an allowed host (${[...SMTP_HOSTS].join(", ")})`);
  }
  if (url.username === "" || url.password === "") {
    throw new Error("SMTP_URL must include a user name and password");
  }
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error("SMTP_URL has a malformed user name or password");
  }
  const secure = url.protocol === "smtps:";
  const port = url.port === "" ? (secure ? 465 : 587) : Number(url.port);
  const credentials = { user: new Secret(user), password: new Secret(password) };
  return { kind: "smtp", host, port, secure, requireTLS: true, ...credentials };
}

function parseEmailTransport(env: Env, environment: DeploymentEnvironment): EmailTransportConfig {
  const smtpUrl = optional(env, "SMTP_URL");
  const captureDir = optional(env, "EMAIL_CAPTURE_DIR");
  if (environment !== "production") {
    // Development and CI can never send real email (002/FR-038).
    if (smtpUrl !== undefined) {
      throw new Error("SMTP_URL is set but DEPLOYMENT_ENVIRONMENT is not production");
    }
    return { kind: "capture", dir: captureDir };
  }
  if (captureDir !== undefined) {
    throw new Error("EMAIL_CAPTURE_DIR is set but DEPLOYMENT_ENVIRONMENT is production");
  }
  if (smtpUrl === undefined) {
    throw new Error("SMTP_URL is required in production");
  }
  return parseSmtpUrl(smtpUrl);
}

function parseEmailFrom(env: Env, environment: DeploymentEnvironment): string {
  const raw = optional(env, "EMAIL_FROM")?.trim();
  if (environment !== "production") {
    return raw ?? DEV_EMAIL_FROM;
  }
  const domain = raw?.slice(raw.lastIndexOf("@") + 1).toLowerCase();
  if (raw === undefined || !isEmailAddress(raw) || domain !== SENDER_DOMAIN) {
    throw new Error(`EMAIL_FROM must be an address on ${SENDER_DOMAIN}`);
  }
  return raw;
}

/** User-perceived characters, so an accented or emoji name counts as it reads. */
function characterCount(value: string): number {
  return [...new Intl.Segmenter().segment(value)].length;
}

function parseApiAuth(env: Env, environment: DeploymentEnvironment): ApiAuthConfig {
  const emailTransport = parseEmailTransport(env, environment);
  const emailFrom = parseEmailFrom(env, environment);
  const adminEmail = optional(env, "INITIAL_ADMIN_EMAIL")?.trim();
  if (adminEmail !== undefined && !isEmailAddress(adminEmail)) {
    throw new Error("INITIAL_ADMIN_EMAIL must be an email address");
  }
  const adminName = optional(env, "INITIAL_ADMIN_NAME")?.trim();
  if (adminName !== undefined && characterCount(adminName) > MAX_ADMIN_NAME) {
    throw new Error(`INITIAL_ADMIN_NAME must be 1 to ${String(MAX_ADMIN_NAME)} characters`);
  }
  return {
    emailFrom,
    emailTransport,
    initialAdmin: adminEmail === undefined ? undefined : { email: adminEmail, name: adminName },
  };
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
  if (environment === "production") {
    checkProductionAppUrl(appUrl);
  }
  const sampleFlows = parseSampleFlows(env, environment);
  const sessionSecret = parseSessionSecret(env, environment);
  // SMTP, the sender and the first admin are api only (002 research R8).
  const apiAuth = role === "api" ? parseApiAuth(env, environment) : undefined;

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
    sampleFlows,
    sessionSecret,
    apiAuth,
  };
}
