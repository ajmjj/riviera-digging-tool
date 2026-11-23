// Pseudonymous staff IDs (001/FR-004, data-model.md §1 `RequestContext.staffId`, §2
// `Job.staff_id`): letters, digits, `-` and `_`, 1–64 characters. No `@` or `.`, so an email
// address can never pass, and no name with spaces either.
const STAFF_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isStaffId(value: string): boolean {
  return STAFF_ID.test(value);
}
