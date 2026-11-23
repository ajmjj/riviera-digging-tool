type Role = "api" | "worker";

export interface Config {
  readonly role: Role;
  readonly port: number;
  readonly databaseUrl: string;
  readonly appUrl: URL;
  readonly logLevel: string;
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
export function loadConfig(env: Env, roleArg: string | undefined): Config {
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

  return { role, port, databaseUrl: required(env, "DATABASE_URL"), appUrl, logLevel };
}
