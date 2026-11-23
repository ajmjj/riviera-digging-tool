import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readYaml, record, records, strings, type Yaml } from "./yaml.ts";

// Static checks of the Grafana provisioning and its compose service (task T015, research R8).
// T023's obs-check proves against the running stack that the links resolve and return data.

const PROVISIONING = "observability/grafana/provisioning";
const datasources = records(
  readYaml(`${PROVISIONING}/datasources/datasources.yaml`)["datasources"],
  "datasources",
);
const providers = records(
  readYaml(`${PROVISIONING}/dashboards/dashboards.yaml`)["providers"],
  "providers",
);
const services = record(readYaml("docker-compose.yml")["services"], "services");
const grafana = record(services["grafana"], "service grafana");
const grafanaEnv = record(grafana["environment"], "grafana environment");

function datasource(uid: string): Yaml {
  const found = datasources.find((item) => item["uid"] === uid);
  if (found === undefined) {
    throw new Error(`no data source with uid ${uid}`);
  }
  return found;
}

const jsonData = (uid: string): Yaml => record(datasource(uid)["jsonData"], `${uid} jsonData`);

/** Every string anywhere in a parsed YAML value. */
function allStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => allStrings(item));
  }
  return typeof value === "object" && value !== null
    ? Object.values(value).flatMap(allStrings)
    : [];
}

/** Grafana's bind mounts as [host path, container path]. */
const mounts: [string, string][] = strings(grafana["volumes"]).map((volume) => {
  const [host = "", container = ""] = volume.split(":");
  return [host, container];
});

/** The repository directory a Grafana container path is mounted from, if any. */
function hostPathOf(containerPath: string): string | undefined {
  for (const [host, container] of mounts) {
    if (host.startsWith("./") && containerPath.startsWith(`${container}/`)) {
      return host.slice(2) + containerPath.slice(container.length);
    }
  }
  return undefined;
}

describe("Grafana data sources", () => {
  it("001/FR-022: provisions Prometheus, Loki and Tempo under the uids the dashboards query", () => {
    expect(datasources.map((item) => [item["uid"], item["type"], item["url"]])).toEqual([
      ["prometheus", "prometheus", "http://prometheus:9090"],
      ["loki", "loki", "http://loki:3100"],
      ["tempo", "tempo", "http://tempo:3200"],
    ]);
    for (const item of datasources) {
      expect(Object.keys(services), String(item["uid"])).toContain(item["uid"]);
    }
  });

  it("001/FR-022: Tempo links a trace to its log lines by trace ID", () => {
    const toLogs = record(jsonData("tempo")["tracesToLogsV2"], "tracesToLogsV2");
    expect(toLogs["datasourceUid"]).toBe("loki");
    expect(toLogs["filterByTraceID"]).toBe(true);
    expect(toLogs["customQuery"]).toBe(true);
    // Loki keeps the OTLP trace ID as structured metadata, so the filter is on that label.
    expect(toLogs["query"]).toBe('{service_name=~".+"} | trace_id="$${__trace.traceId}"');
  });

  it("001/FR-022: Tempo links a trace to its service's request and job metrics", () => {
    const toMetrics = record(jsonData("tempo")["tracesToMetrics"], "tracesToMetrics");
    expect(toMetrics["datasourceUid"]).toBe("prometheus");
    expect(records(toMetrics["tags"], "tags")).toEqual([
      { key: "service.name", value: "service_name" },
    ]);
    const queries = records(toMetrics["queries"], "queries").map((query) => String(query["query"]));
    expect(
      queries.filter((query) => query.includes("riviera_http_server_duration_seconds_")),
    ).toHaveLength(2);
    expect(
      queries.filter((query) => /riviera_jobs_(runs_total|duration_seconds_)/.test(query)),
    ).toHaveLength(2);
    for (const query of queries) {
      expect(query).toContain("{$$__tags}");
    }
  });

  it("001/FR-022: Loki links a log line's trace_id to that trace in Tempo", () => {
    expect(records(jsonData("loki")["derivedFields"], "derivedFields")).toEqual([
      {
        name: "trace_id",
        matcherType: "label",
        matcherRegex: "trace_id",
        datasourceUid: "tempo",
        url: "$${__value.raw}",
        urlDisplayLabel: "Open trace",
      },
    ]);
  });

  it("001/FR-022: escapes Grafana's own variables so provisioning does not expand them to empty", () => {
    const variables = allStrings(datasources).flatMap((value) => [...value.matchAll(/\$+\{?__/g)]);
    expect(variables.length).toBeGreaterThan(0);
    for (const [match] of variables) {
      expect(match).toMatch(/^\$\$\{?__$/);
    }
  });
});

describe("Grafana dashboards and service", () => {
  it("001/FR-022: provisions the folders SLOs and Service, each from its own mounted directory", () => {
    expect(providers.map((provider) => provider["folder"])).toEqual(["SLOs", "Service"]);
    const paths = providers.map((provider) =>
      String(record(provider["options"], "options")["path"]),
    );
    for (const [index, path] of paths.entries()) {
      expect(providers[index]?.["type"]).toBe("file");
      // A provider scans its path recursively, so nesting would load dashboards twice.
      for (const other of paths.filter((_, i) => i !== index)) {
        expect(path.startsWith(`${other}/`), `${path} inside ${other}`).toBe(false);
      }
      const host = hostPathOf(path);
      expect(host, path).toBeDefined();
      expect(statSync(host ?? "").isDirectory(), path).toBe(true);
    }
  });

  it("001/FR-022: mounts the provisioning directory where Grafana reads it at start", () => {
    expect(mounts).toContainEqual([`./${PROVISIONING}`, "/etc/grafana/provisioning"]);
    expect(existsSync(`${PROVISIONING}/datasources/datasources.yaml`)).toBe(true);
    expect(existsSync(`${PROVISIONING}/dashboards/dashboards.yaml`)).toBe(true);
  });

  it("001/FR-022: anonymous visitors can view the dashboards without signing in", () => {
    expect(grafanaEnv["GF_AUTH_ANONYMOUS_ENABLED"]).toBe("true");
    expect(grafanaEnv["GF_AUTH_ANONYMOUS_ORG_ROLE"]).toBe("Viewer");
  });

  it("takes the admin password only from .env and refuses to start without one", () => {
    expect(grafanaEnv["GF_SECURITY_ADMIN_PASSWORD"]).toBe("${GRAFANA_ADMIN_PASSWORD:-}");
    const entrypoint = strings(grafana["entrypoint"]).join(" ");
    expect(entrypoint).toContain('test -n "$$GF_SECURITY_ADMIN_PASSWORD" ||');
    expect(entrypoint).toMatch(/exit 1; }; exec \/run\.sh$/);
  });

  it("never requires a GRAFANA_ variable, so plain `make up` works without them", () => {
    // Compose interpolates the whole file, even services outside the active profiles.
    for (const value of allStrings(grafana)) {
      expect(value).not.toMatch(/\$\{GRAFANA_\w+:?\?/);
    }
  });

  it("publishes Grafana on 127.0.0.1, port 3300 unless GRAFANA_PORT says otherwise", () => {
    expect(strings(grafana["ports"])).toEqual(["127.0.0.1:${GRAFANA_PORT:-3300}:3000"]);
  });
});
