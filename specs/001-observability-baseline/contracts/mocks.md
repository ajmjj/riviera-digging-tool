# Contract: Common Ground and Discogs mocks (`apps/mocks`)

One service, `mocks`, behind the compose profile `dev` (container port 4000, not published), so it
runs only in development (`make up-dev`) and CI, never on the host's plain stack (FR-013, research
R17).

## Common Ground: `POST /graphql`

- Accepts `{ "operationName": string, "query": string, "variables"?: object }`.
- Known operations answer from `apps/mocks/fixtures/common-ground/<OperationName>.json`:
  - `SampleShopConfig` → `{ "data": { "config": { "shopName": "Riviera Records (mock)" } } }`
- Unknown operation → `400 { "errors": [{ "message": "mock: unknown operation <name>" }] }`.
- Requires an `Authorization` header to be present (any value), like the real Admin API, so the
  client's header handling and its redaction are exercised; the value is never logged.

Operation document: `packages/common-ground/operations/admin/SampleShopConfig.graphql`

```graphql
query SampleShopConfig {
  config {
    shopName
  }
}
```

Contract test: the fixture parses as the generated `SampleShopConfigQuery` result (zod schema
derived from the generated type's shape) and the document validates against
`contracts/common-ground/admin.graphql` (codegen).

## Discogs: `GET /releases/:id`

- Answers from `apps/mocks/fixtures/discogs/release-<id>.json`, or the default
  `release-249504.json` for any other positive integer id.
- Fixture shape (zod, in the mocks app): `{ id: number, title: string, year: number,
  videos?: { uri: string, title: string, duration: number }[] }`.
- Non-integer id → `404 { "message": "Release not found." }`.

## Control: `POST /_mock/next`

```json
{ "service": "common_ground" | "discogs", "outcome": "fail" | "rate_limited", "times": 1 }
```

The next `times` (1–100) requests to that service answer `500 { "message": "mock failure" }` or
`429 { "message": "You are making requests too quickly." }` with `Retry-After: 60`. `POST
/_mock/reset` clears all pending outcomes. `GET /healthz` → `200 { "status": "ok" }` (compose
healthcheck).
