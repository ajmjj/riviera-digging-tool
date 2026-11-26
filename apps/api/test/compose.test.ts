import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isRecord, readYaml, record, strings, type Yaml } from "./yaml.ts";

// Static checks of docker-compose.yml and the collector config (tasks T014, T015, research R7–R10, R17).
// `make up-observability` and the CI stack job prove the same stack actually comes up healthy.

const compose = readYaml("docker-compose.yml");
const services = record(compose["services"], "services");
const serviceNames = Object.keys(services);
const service = (name: string): Yaml => record(services[name], `service ${name}`);
const profilesOf = (name: string): string[] => strings(service(name)["profiles"]);

const OBSERVABILITY = ["otel-collector", "loki", "tempo", "prometheus", "grafana"];
const APP_SERVICES = ["db", "api", "worker", "web", "proxy"];

function dependsOn(name: string): string[] {
  const value = service(name)["depends_on"];
  if (Array.isArray(value)) {
    return strings(value);
  }
  return isRecord(value) ? Object.keys(value) : [];
}

function environment(name: string): Yaml {
  return record(service(name)["environment"], `${name} environment`);
}

/** Every image a service uses: its `image:`, or for a build, the FROM lines of its Dockerfile. */
function upstreamImages(name: string): string[] {
  const build = service(name)["build"];
  if (isRecord(build) && typeof build["dockerfile"] === "string") {
    const dockerfile = readFileSync(build["dockerfile"], "utf8");
    return [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((match) => match[1] ?? "");
  }
  const image = service(name)["image"];
  return typeof image === "string" ? [image] : [];
}

describe("compose profile observability", () => {
  it("001/FR-021: the observability services exist and sit only behind the profile observability", () => {
    for (const name of OBSERVABILITY) {
      expect(profilesOf(name), name).toEqual(["observability"]);
    }
  });

  it("001/FR-021: the default stack has no profile, so `make up` starts none of it", () => {
    for (const name of APP_SERVICES) {
      expect(profilesOf(name), name).toEqual([]);
    }
  });

  it("001/FR-021: every observability service has a healthcheck that runs a probe", () => {
    for (const name of OBSERVABILITY) {
      const healthcheck = record(service(name)["healthcheck"], `${name} healthcheck`);
      const test = strings(healthcheck["test"]);
      expect(test[0], name).toBe("CMD");
      expect(test.join(" "), name).toMatch(/wget -q --spider http:\/\/127\.0\.0\.1:\d+\//);
    }
  });

  it("001/FR-021: every published port of every service binds to 127.0.0.1", () => {
    const published: unknown[] = serviceNames.flatMap((name) => {
      const ports: unknown = service(name)["ports"];
      return Array.isArray(ports) ? ports.map((port: unknown) => port) : [];
    });
    expect(published.length).toBeGreaterThan(OBSERVABILITY.length);
    for (const port of published) {
      // Long-syntax entries (objects) are rejected, so none can slip past the address check.
      expect(typeof port).toBe("string");
      expect(port).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it("001/FR-021: no service outside the profile depends on an observability service", () => {
    for (const name of serviceNames.filter((n) => !profilesOf(n).includes("observability"))) {
      for (const dependency of dependsOn(name)) {
        expect(OBSERVABILITY, `${name} depends on ${dependency}`).not.toContain(dependency);
      }
    }
  });

  it("001/FR-021: every upstream image of the profile is pinned by tag and digest", () => {
    for (const name of OBSERVABILITY) {
      const images = upstreamImages(name);
      expect(images.length, name).toBeGreaterThan(0);
      for (const image of images) {
        expect(image, name).toMatch(/^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
      }
    }
  });

  it("001/FR-021: Loki and Tempo keep 7 days (research R10) on named volumes", () => {
    const volumes = Object.keys(record(compose["volumes"], "volumes"));
    for (const name of ["loki", "tempo", "prometheus"]) {
      const mounts = strings(service(name)["volumes"]);
      const named = mounts.filter((mount) => volumes.includes(mount.split(":")[0] ?? ""));
      expect(named, name).toHaveLength(1);
    }
    const loki = readYaml("observability/loki.yaml");
    expect(record(loki["limits_config"], "limits_config")["retention_period"]).toBe("168h");
    expect(record(loki["compactor"], "compactor")["retention_enabled"]).toBe(true);
    const tempoCompactor = record(readYaml("observability/tempo.yaml")["compactor"], "compactor");
    expect(record(tempoCompactor["compaction"], "compaction")["block_retention"]).toBe("168h");
  });

  it("001/FR-024: Prometheus keeps 30 days, enough for the 28-day SLO window", () => {
    expect(strings(service("prometheus")["command"])).toContain(
      "--storage.tsdb.retention.time=30d",
    );
  });

  it("001/FR-013: mocks run only in the profile dev, and nothing else does", () => {
    expect(serviceNames).toContain("mocks");
    expect(profilesOf("mocks")).toEqual(["dev"]);
    expect(serviceNames.filter((n) => profilesOf(n).includes("dev"))).toEqual(["mocks"]);
  });

  it("001/FR-019: api and worker default to no export endpoint", () => {
    for (const name of ["api", "worker"]) {
      expect(environment(name)["OTEL_EXPORTER_OTLP_ENDPOINT"], name).toBe(
        "${OTEL_EXPORTER_OTLP_ENDPOINT:-}",
      );
    }
  });

  it("001/FR-027: api and worker default to sample flows off, outside development", () => {
    for (const name of ["api", "worker"]) {
      const env = environment(name);
      expect(env["SAMPLE_FLOWS_ENABLED"], name).toBe("${SAMPLE_FLOWS_ENABLED:-false}");
      expect(env["DEPLOYMENT_ENVIRONMENT"], name).toBe("${DEPLOYMENT_ENVIRONMENT:-production}");
      expect(env["COMMON_GROUND_URL"], name).toBe("${COMMON_GROUND_URL:-}");
      expect(env["DISCOGS_URL"], name).toBe("${DISCOGS_URL:-}");
    }
  });

  it("001/FR-027: only the api gets the Common Ground mock key, empty by default and set by up-dev", () => {
    expect(environment("api")["COMMON_GROUND_DEV_API_KEY"]).toBe("${COMMON_GROUND_DEV_API_KEY:-}");
    expect(environment("worker")["COMMON_GROUND_DEV_API_KEY"]).toBeUndefined();
    const makefile = readFileSync("Makefile", "utf8");
    const sampleFlows = /^SAMPLE_FLOWS := ((?:.*\\\n)*.*)$/m.exec(makefile)?.[1] ?? "";
    expect(sampleFlows).toMatch(/\bCOMMON_GROUND_DEV_API_KEY=dev-only-mock-key\b/);
    expect(makefile).toMatch(
      /^up-dev:.*\n\t\$\(OTLP_ENDPOINT\) \$\(SAMPLE_FLOWS\) docker compose/m,
    );
  });
});

describe("collector config", () => {
  const config = readYaml("observability/otel-collector.yaml");
  const processors = record(config["processors"], "processors");
  const pipelines = record(record(config["service"], "service")["pipelines"], "pipelines");

  it("001/FR-021: has traces, metrics and logs pipelines from OTLP through memory_limiter and batch", () => {
    expect(Object.keys(pipelines).sort()).toEqual(["logs", "metrics", "traces"]);
    for (const [name, value] of Object.entries(pipelines)) {
      const pipeline = record(value, `pipeline ${name}`);
      expect(strings(pipeline["receivers"]), name).toEqual(["otlp"]);
      expect(strings(pipeline["processors"]), name).toEqual(["memory_limiter", "batch"]);
    }
    expect(strings(record(pipelines["traces"], "traces")["exporters"])).toEqual(["otlp/tempo"]);
    expect(strings(record(pipelines["logs"], "logs")["exporters"])).toEqual(["otlphttp/loki"]);
    expect(strings(record(pipelines["metrics"], "metrics")["exporters"])).toEqual([
      "otlphttp/prometheus",
    ]);
  });

  it("001/FR-023: defines no sampling processor, so every trace is kept", () => {
    expect(Object.keys(processors).sort()).toEqual(["batch", "memory_limiter"]);
    for (const name of Object.keys(processors)) {
      expect(name).not.toMatch(/sampl/i);
    }
  });
});

describe("auth settings in compose, the Makefile and CI (002, research R8)", () => {
  const API_ONLY = ["SMTP_URL", "EMAIL_FROM", "INITIAL_ADMIN_EMAIL", "INITIAL_ADMIN_NAME"];
  const makefile = readFileSync("Makefile", "utf8");
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  const capture = readYaml("docker-compose.capture.yml");
  const captureServices = record(capture["services"], "capture services");
  const captureApi = record(captureServices["api"], "capture api");
  const upDevLines = makefile.split("\n").filter((line) => line.startsWith("up-dev:"));

  it("002/FR-036: the session secret reaches api and worker from .env only, empty by default", () => {
    for (const name of ["api", "worker"]) {
      expect(environment(name)["SESSION_SECRET"], name).toBe("${SESSION_SECRET:-}");
    }
  });

  it("002/FR-036: SMTP, sender and first-admin settings reach only the api, empty by default", () => {
    for (const setting of API_ONLY) {
      expect(environment("api")[setting], setting).toBe(`\${${setting}:-}`);
      expect(environment("worker")[setting], setting).toBeUndefined();
    }
  });

  it("002/FR-038: no compose file, Makefile target or CI step sets SMTP_URL", () => {
    // Only the api passes the operator's own value through; no service sets one.
    for (const name of serviceNames) {
      const env = service(name)["environment"];
      const value = isRecord(env) ? env["SMTP_URL"] : undefined;
      expect(value, name).toBe(name === "api" ? "${SMTP_URL:-}" : undefined);
    }
    expect(readFileSync("docker-compose.capture.yml", "utf8")).not.toContain("SMTP_URL");
    // Any assignment: `SMTP_URL=`, `SMTP_URL :=` or a YAML `SMTP_URL:`.
    const assignment = /\bSMTP_URL\s*(?::?=|:)/;
    expect(makefile).not.toMatch(assignment);
    expect(ci).not.toMatch(assignment);
  });

  it("002/FR-038: email capture is mounted only by docker-compose.capture.yml, on the api only", () => {
    expect(Object.keys(captureServices)).toEqual(["api"]);
    expect(record(captureApi["environment"], "capture api environment")).toEqual({
      EMAIL_CAPTURE_DIR: "/var/lib/riviera/mail",
    });
    expect(strings(captureApi["volumes"])).toEqual(["./.captured-mail:/var/lib/riviera/mail"]);
    for (const name of serviceNames) {
      const env = service(name)["environment"];
      expect(isRecord(env) ? env["EMAIL_CAPTURE_DIR"] : undefined, name).toBeUndefined();
      const mounts = strings(service(name)["volumes"]);
      expect(mounts.join(" "), name).not.toContain("/var/lib/riviera/mail");
    }
  });

  it("002/FR-038: up-dev captures email as development with the placeholder secret; up does not", () => {
    expect(upDevLines).toEqual([
      "up-dev: export COMPOSE_FILE := docker-compose.yml:docker-compose.capture.yml",
      "up-dev: export SESSION_SECRET := dev-only-session-secret-0000000000000000",
      "up-dev: export INITIAL_ADMIN_EMAIL := admin@dev.invalid",
      "up-dev: export DEPLOYMENT_ENVIRONMENT := development",
      "up-dev: env captured-mail ## Start the stack with the dev (mocks, sample flows) and observability profiles",
    ]);
    expect(makefile).toMatch(
      /^captured-mail:.*\n\trm -rf \.captured-mail\n\tmkdir -p \.captured-mail$/m,
    );
    expect(makefile).not.toMatch(/^up:.*capture/m);
    expect(makefile.match(/docker-compose\.capture\.yml/g)).toHaveLength(1);
  });

  it("002/FR-038: the CI stack job captures email and never runs as production", () => {
    expect(ci).toContain("COMPOSE_FILE: docker-compose.yml:docker-compose.capture.yml");
    expect(ci).toContain("APP_URL: http://localhost:8080");
    expect(ci).toContain("E2E_BASE_URL: http://localhost:8080");
    expect(ci).toContain("INITIAL_ADMIN_EMAIL: admin@ci.invalid");
    // Both stack-ups: the plain one and the one with the dev and observability profiles.
    expect(ci.match(/DEPLOYMENT_ENVIRONMENT: ci$/gm)).toHaveLength(2);
    expect(ci.match(/SESSION_SECRET: dev-only-session-secret-0{16}$/gm)).toHaveLength(2);
    expect(ci.match(/sudo chown 1000:1000 \.captured-mail$/gm)).toHaveLength(2);
  });

  it("002/FR-036: captured mail and the CI session file are never committed", () => {
    const ignored = readFileSync(".gitignore", "utf8").split("\n");
    expect(ignored).toContain(".captured-mail/");
    expect(ignored).toContain(".ci-session/");
  });
});
