// Opaque IDs (data-model.md §1 `RequestContext.requestId` and `.staffId`, §2 `Job.staff_id`):
// letters, digits, `-` and `_`, 1–64 characters. No `@` or `.`, so an email address can never
// pass, and no name with spaces either.
const OPAQUE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** The request ID rule of 001/FR-003; the staff ID rule below is the same pattern. */
export function isOpaqueId(value: string): boolean {
  return OPAQUE_ID.test(value);
}

/** Pseudonymous staff IDs (001/FR-004). */
export function isStaffId(value: string): boolean {
  return isOpaqueId(value);
}
