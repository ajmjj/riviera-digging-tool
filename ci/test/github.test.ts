import { describe, expect, it } from "vitest";
import { changedFilenames, createGitHub, labelNames, toLabelEvents } from "../lib/github.ts";

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string | undefined;
}

function recordingFetch(responses: (url: string) => Response): {
  fetchFn: typeof fetch;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetchFn: typeof fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === "string" ? init.body : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers, body });
    return Promise.resolve(responses(url));
  };
  return { fetchFn, calls };
}

describe("createGitHub", () => {
  it("sends the token and API version and parses JSON", async () => {
    const { fetchFn, calls } = recordingFetch(() => Response.json({ ok: true }));
    const gh = createGitHub("t0k", "o/r", fetchFn);
    await expect(gh.get("/repos/o/r")).resolves.toEqual({ ok: true });
    expect(gh.repo).toBe("o/r");
    expect(calls[0]?.url).toBe("https://api.github.com/repos/o/r");
    expect(calls[0]?.headers).toMatchObject({
      authorization: "Bearer t0k",
      "x-github-api-version": "2022-11-28",
      accept: "application/vnd.github+json",
    });
  });

  it("fetches raw text with a custom media type", async () => {
    const { fetchFn, calls } = recordingFetch(() => new Response("diff --git"));
    const gh = createGitHub("t", "o/r", fetchFn);
    await expect(gh.getText("/repos/o/r/pulls/1", "application/vnd.github.diff")).resolves.toBe(
      "diff --git",
    );
    expect(calls[0]?.headers["accept"]).toBe("application/vnd.github.diff");
  });

  it("follows Link: rel=next across pages", async () => {
    const { fetchFn, calls } = recordingFetch((url) =>
      url.includes("page=2")
        ? Response.json([3])
        : Response.json([1, 2], {
            headers: {
              link: '<https://api.github.com/x?page=1>; rel="prev", <https://api.github.com/x?per_page=100&page=2>; rel="next"',
            },
          }),
    );
    const gh = createGitHub("t", "o/r", fetchFn);
    await expect(gh.getAll("/x")).resolves.toEqual([1, 2, 3]);
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.github.com/x?per_page=100",
      "https://api.github.com/x?per_page=100&page=2",
    ]);
    await gh.getAll("/y?state=all");
    expect(calls[2]?.url).toBe("https://api.github.com/y?state=all&per_page=100");
  });

  it("rejects a paged endpoint that does not return a list", async () => {
    const { fetchFn } = recordingFetch(() => Response.json({}));
    await expect(createGitHub("t", "o/r", fetchFn).getAll("/x")).rejects.toThrow(
      "did not return a list",
    );
  });

  it("sends JSON bodies and handles 204", async () => {
    const { fetchFn, calls } = recordingFetch((url) =>
      url.endsWith("/labels/x") ? new Response(null, { status: 204 }) : Response.json({ id: 1 }),
    );
    const gh = createGitHub("t", "o/r", fetchFn);
    await expect(gh.send("POST", "/a", { b: 1 })).resolves.toEqual({ id: 1 });
    expect(calls[0]).toMatchObject({ method: "POST", body: '{"b":1}' });
    expect(calls[0]?.headers["content-type"]).toBe("application/json");
    await expect(gh.send("DELETE", "/labels/x")).resolves.toBeUndefined();
    expect(calls[1]?.body).toBeUndefined();
  });

  it("throws on HTTP errors, naming the method and URL", async () => {
    const { fetchFn } = recordingFetch(() => new Response("no", { status: 404 }));
    const gh = createGitHub("t", "o/r", fetchFn);
    await expect(gh.get("/missing")).rejects.toThrow(
      "GitHub GET https://api.github.com/missing failed: HTTP 404",
    );
    await expect(gh.send("PATCH", "/m", {})).rejects.toThrow("GitHub PATCH");
  });

  it("adds GitHub's message and the permissions it wanted to the error", async () => {
    const { fetchFn } = recordingFetch(
      () =>
        new Response('{"message":"Resource not accessible by integration"}', {
          status: 403,
          headers: { "x-accepted-github-permissions": "issues=write; pull_requests=write" },
        }),
    );
    const gh = createGitHub("t", "o/r", fetchFn);
    await expect(gh.send("DELETE", "/labels/x")).rejects.toThrow(
      "HTTP 403 (needs one of: issues=write; pull_requests=write): " +
        '{"message":"Resource not accessible by integration"}',
    );
  });
});

describe("timeline and PR helpers", () => {
  it("keeps only well-formed label events and records the app they went through", () => {
    expect(
      toLabelEvents([
        {
          event: "labeled",
          label: { name: "a" },
          actor: { login: "u" },
          performed_via_github_app: null,
          created_at: "t1",
        },
        {
          event: "unlabeled",
          label: { name: "a" },
          actor: { login: "u" },
          performed_via_github_app: { slug: "claude" },
          created_at: "t2",
        },
        {
          event: "labeled",
          label: { name: "b" },
          actor: { login: "u" },
          performed_via_github_app: { id: 1 },
          created_at: "t3",
        },
        { event: "labeled", label: { name: "c" }, actor: { login: "u" }, created_at: "t4" },
        { event: "commented", actor: { login: "u" } },
        { event: "labeled", label: {}, actor: { login: "u" }, created_at: "t5" },
        null,
        "x",
      ]),
    ).toEqual([
      { event: "labeled", label: "a", actor: "u", viaApp: null, createdAt: "t1" },
      { event: "unlabeled", label: "a", actor: "u", viaApp: "claude", createdAt: "t2" },
      { event: "labeled", label: "b", actor: "u", viaApp: "unknown-app", createdAt: "t3" },
      { event: "labeled", label: "c", actor: "u", viaApp: null, createdAt: "t4" },
    ]);
  });

  it("reads label names and tolerates missing labels", () => {
    expect(labelNames({ labels: [{ name: "x" }, { id: 2 }, { name: "y" }] })).toEqual(["x", "y"]);
    expect(labelNames({})).toEqual([]);
  });

  it("lists changed files including the old name of renamed files", () => {
    expect(
      changedFilenames([
        { filename: "a.ts" },
        { filename: "apps/x.ts", previous_filename: "ci/x.ts" },
        { status: "weird" },
      ]),
    ).toEqual(["a.ts", "apps/x.ts", "ci/x.ts"]);
  });
});
