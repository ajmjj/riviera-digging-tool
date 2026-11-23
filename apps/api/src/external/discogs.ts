// Discogs through the shared outbound client (001/FR-012). Only the sample release lookup of
// specs/001-observability-baseline exists so far; in development and CI it reaches the mock
// (contracts/mocks.md).

import { z } from "zod";
import type { ApiKey, ExternalClient } from "./client.ts";

const releaseSchema = z.object({
  id: z.int(),
  title: z.string(),
  year: z.int(),
  videos: z
    .array(z.object({ uri: z.string(), title: z.string(), duration: z.number() }))
    .optional(),
});

type Release = z.infer<typeof releaseSchema>;

export interface Discogs {
  readonly release: (id: number) => Promise<Release>;
}

export interface DiscogsOptions {
  readonly client: ExternalClient;
  /** `DISCOGS_URL`. */
  readonly url: URL;
  /**
   * A personal access token. It goes in the Authorization header, never the query string,
   * which upstream (and the mock) may log.
   */
  readonly token?: ApiKey | undefined;
}

export function createDiscogs(options: DiscogsOptions): Discogs {
  return {
    async release(id) {
      if (!Number.isSafeInteger(id) || id < 1) {
        throw new RangeError("Discogs release id must be a positive integer");
      }
      const headers: Record<string, string> = { accept: "application/json" };
      if (options.token !== undefined) {
        headers["authorization"] = `Discogs token=${options.token.reveal()}`;
      }
      return options.client.call({
        service: "discogs",
        operation: "GET /releases/{id}",
        method: "GET",
        url: new URL(`/releases/${String(id)}`, options.url),
        headers,
        parse: (body) => releaseSchema.parse(body),
      });
    },
  };
}
