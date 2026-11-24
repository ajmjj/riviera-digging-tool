// The sample job `sample.discogs_release` (001/FR-028): one mocked Discogs call under the job's
// span, then, in fail mode, a deliberate failure so the failure telemetry can be followed too
// (001/FR-031). The sample request enqueues fail mode with `max_attempts = 1`, so it fails once.

import type { Discogs } from "../external/discogs.ts";
import type { JobHandler } from "../jobs/runner.ts";

export function sampleDiscogsRelease(
  discogs: Pick<Discogs, "release"> | undefined,
): JobHandler<"sample.discogs_release"> {
  return async ({ releaseId, fail }, run) => {
    // Only the sample route enqueues this job, so without sample flows it can't be due; a stray
    // row fails instead of reaching a Discogs URL nobody configured.
    if (discogs === undefined) {
      throw new Error("sample flows are off: no Discogs mock configured");
    }
    const release = await discogs.release(releaseId);
    run.log.info({ release_id: release.id }, "sample job fetched release");
    if (fail) {
      throw new Error("sample job failed on purpose (fail mode)");
    }
  };
}
