import type { LabelEvent } from "./human-gate.ts";

export interface GitHub {
  readonly repo: string;
  get(path: string): Promise<unknown>;
  /** Raw body with a custom media type, e.g. a PR diff or raw file contents. */
  getText(path: string, accept: string): Promise<string>;
  getAll(path: string): Promise<unknown[]>;
  send(method: "POST" | "DELETE" | "PATCH", path: string, body?: unknown): Promise<unknown>;
}

const API = "https://api.github.com";

function nextLink(header: string | null): string | undefined {
  return header
    ?.split(",")
    .map((part) => /<([^>]+)>;\s*rel="next"/.exec(part)?.[1])
    .find((url) => url !== undefined);
}

export function createGitHub(token: string, repo: string, fetchFn: typeof fetch): GitHub {
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
  };

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const merged = new Headers(headers);
    new Headers(init.headers).forEach((value, key) => {
      merged.set(key, value);
    });
    const res = await fetchFn(url, { ...init, headers: merged });
    if (!res.ok) {
      throw new Error(`GitHub ${init.method ?? "GET"} ${url} failed: HTTP ${String(res.status)}`);
    }
    return res;
  }

  return {
    repo,
    async get(path) {
      const res = await request(`${API}${path}`);
      return res.json();
    },
    async getText(path, accept) {
      const res = await request(`${API}${path}`, { headers: { accept } });
      return res.text();
    },
    async getAll(path) {
      const items: unknown[] = [];
      let url: string | undefined = `${API}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
      while (url !== undefined) {
        const res = await request(url);
        const page: unknown = await res.json();
        if (!Array.isArray(page)) {
          throw new Error(`GitHub GET ${url} did not return a list`);
        }
        for (const item of page) {
          items.push(item);
        }
        url = nextLink(res.headers.get("link"));
      }
      return items;
    },
    async send(method, path, body) {
      const res = await request(`${API}${path}`, {
        method,
        ...(body === undefined
          ? {}
          : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
      });
      return res.status === 204 ? undefined : res.json();
    },
  };
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" ? Reflect.get(value, key) : undefined;
}

/** Maps raw issue-timeline items to the label events the human gate needs. */
export function toLabelEvents(timeline: readonly unknown[]): LabelEvent[] {
  const events: LabelEvent[] = [];
  for (const item of timeline) {
    const event = field(item, "event");
    if (event !== "labeled" && event !== "unlabeled") {
      continue;
    }
    const label = field(field(item, "label"), "name");
    const actor = field(field(item, "actor"), "login");
    const app = field(item, "performed_via_github_app");
    const createdAt = field(item, "created_at");
    if (typeof label !== "string" || typeof actor !== "string" || typeof createdAt !== "string") {
      continue;
    }
    const appSlug = field(app, "slug");
    events.push({
      event,
      label,
      actor,
      viaApp:
        app === null || app === undefined
          ? null
          : typeof appSlug === "string"
            ? appSlug
            : "unknown-app",
      createdAt,
    });
  }
  return events;
}

/** Names of the labels currently on an issue or PR. */
export function labelNames(issue: unknown): string[] {
  const labels = field(issue, "labels");
  if (!Array.isArray(labels)) {
    return [];
  }
  return labels.map((l: unknown) => field(l, "name")).filter((n) => typeof n === "string");
}

/** Repo-relative paths of the files a PR changes (from the pulls/{n}/files API). */
export function changedFilenames(files: readonly unknown[]): string[] {
  const names: string[] = [];
  for (const file of files) {
    for (const key of ["filename", "previous_filename"]) {
      const name = field(file, key);
      if (typeof name === "string") {
        names.push(name);
      }
    }
  }
  return names;
}
