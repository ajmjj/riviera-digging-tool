# Specification Quality Checklist: Auth

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- **Three markers left for `/speckit-clarify`.** FR-013 (session lifetime, idle timeout,
  remember-me), FR-030 (demoting admins, self-deactivation) and FR-037 (SMTP provider). They are
  put to Antn one at a time in clarify instead of all at once here, as he asked.
- **Proposed values to confirm in clarify.** FR-005 (15-minute sign-in link, 7-day invite link),
  FR-020 and FR-021 (rate limits). See Assumptions.
- **Named settings and status codes are constraints, not design.** `APP_URL`, `SESSION_SECRET`,
  `SMTP_URL`, 401/403 and the cookie properties come from the brief, the constitution and
  `.env.example`, and they are what the security tests assert. The spec doesn't choose libraries,
  storage layout or the CSRF token mechanism; those belong in `/speckit-plan`.
