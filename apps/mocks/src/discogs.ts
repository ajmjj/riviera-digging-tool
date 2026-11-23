import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Control } from "./control.ts";

// Discogs mock: `GET /releases/:id` from recorded fixtures (contracts/mocks.md; 001/FR-013).
// There is no Discogs contract in contracts/ yet, so this schema is the fixture contract.

export const releaseSchema = z.object({
  id: z.int(),
  title: z.string(),
  year: z.int(),
  videos: z
    .array(z.object({ uri: z.string(), title: z.string(), duration: z.number() }))
    .optional(),
});

type Release = z.infer<typeof releaseSchema>;

const DEFAULT_RELEASE_ID = 249504;

/** Reads and validates every `release-<id>.json` in `dir`, keyed by id. */
export function loadReleaseFixtures(dir: string): ReadonlyMap<number, Release> {
  const releases = new Map<number, Release>();
  for (const file of readdirSync(dir)) {
    const match = /^release-(\d+)\.json$/.exec(file);
    if (match?.[1] !== undefined) {
      const raw: unknown = JSON.parse(readFileSync(join(dir, file), "utf8"));
      releases.set(Number(match[1]), releaseSchema.parse(raw));
    }
  }
  if (!releases.has(DEFAULT_RELEASE_ID)) {
    throw new Error(`Missing default Discogs fixture release-${String(DEFAULT_RELEASE_ID)}.json`);
  }
  return releases;
}

export function registerDiscogsRoutes(
  app: FastifyInstance,
  control: Control,
  releases: ReadonlyMap<number, Release>,
): void {
  app.get<{ Params: { id: string } }>("/releases/:id", async (request, reply) => {
    const { id } = request.params;
    const releaseId = Number(id);
    if (!/^\d+$/.test(id) || releaseId < 1 || !Number.isSafeInteger(releaseId)) {
      return reply.code(404).send({ message: "Release not found." });
    }
    if (control.intercept("discogs", reply)) {
      return reply;
    }
    return reply.send(releases.get(releaseId) ?? releases.get(DEFAULT_RELEASE_ID));
  });
}
