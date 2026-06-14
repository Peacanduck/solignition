# Changelog

Notable changes to the Solignition repo land here. The structure mirrors the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format but is
release-agnostic — entries describe what shipped to `main`, dated when merged.

The **## API** sections below are the contract surface for the deployer service
(`deployer/openapi.json`). Any change to that spec **must** be paired with a new
`## API` entry, enforced by `.github/workflows/deployer-api-contract.yml`.

---

## Unreleased

### API — production server URL in the OpenAPI spec

`openapi.json` (and `GET /openapi.json`) now advertise the production base URL
`https://api.solignition.ngrok.app` in `servers[0].url` instead of the relative
`/`. The generator hardcodes it so the committed baseline stays deterministic.
Informational for clients and Swagger UI only — no endpoint, schema, or
status-code changes.

### API — v1 launched, unversioned endpoints removed (breaking)

The deployer's HTTP surface was refactored from an ad-hoc mix of RPC and REST
endpoints into a single versioned `/v1/...` namespace with consistent status
codes, zod-validated request shapes, and a generated OpenAPI 3.1 spec at
`/openapi.json` (and Swagger UI at `/docs`).

**Breaking — every endpoint that wasn't a health check moved.** Client
migration is mechanical. The path mapping:

| Old | New | Notes |
| --- | --- | --- |
| `POST /upload` | `POST /v1/uploads` | 201 + `Location: /v1/uploads/:fileId`. Multipart now also accepts an optional `expectedHash` field (sha256 of the file bytes); when supplied, server rejects with 422 `hash_mismatch` if its own computed hash differs. |
| `GET /uploads/:fileId` | `GET /v1/uploads/:fileId` | Response shape unchanged. |
| `GET /uploads/borrower/:borrower[?status]` | `GET /v1/uploads?borrower=…&status=…&limit=…&offset=…` | Borrower moved to query param. **Response shape changed** from `FileUploadRecord[]` to `{uploads, total, limit, offset, hasMore}`. Server caps `limit` at 200; default 50. |
| `GET /uploads/borrower/:borrower/paginated` | (gone) | Merged into the line above. |
| `DELETE /uploads/:fileId` | `DELETE /v1/uploads/:fileId` | Returns **204 No Content**; no body. Authz is now via `X-Auth-Pubkey` only (the legacy body `{borrower}` is ignored). |
| `GET /deployments/:loanId` | `GET /v1/deployments/:loanId` | Response shape unchanged. |
| `GET /deployments/borrower/:borrower` | `GET /v1/deployments?borrower=…&limit=…&offset=…` | Same envelope change as uploads list. |
| `POST /notify-loan` | `POST /v1/loans` | 201. Body unchanged: `{signature, borrower, loanId, fileId}`. |
| `POST /notify-repaid` | `POST /v1/loans/:loanId/repayments` | 201. **`loanId` moved into the URL** and is no longer in the body — body is now `{signature, borrower}` only. |
| *(missing — frontend was 404ing)* | `GET /v1/loans/:loanId/status` | **New.** Aggregated lifecycle status: `pending | uploading | deploying | deployed | failed | repaid | expired`. |
| `POST /check-expired-loans` | `POST /v1/jobs/expired-loan-check` | 202 Accepted; returns `{success, message, jobId}`. |
| `GET /health` | `GET /health` | **Body slimmed** from `{status, activeLoans, totalDeployments, timestamp}` to `{status:"ok"}`. The counts are still exposed via `/metrics` (Prometheus). |
| `GET /metrics` | unchanged | The auth-failure counter `deployer_http_auth_failures_total` now carries an additional `endpoint` label. |
| *(none)* | `GET /openapi.json`, `GET /docs` | **New.** Machine-readable spec and Swagger UI. |

### Security (OWASP hardening that shipped with v1)

- **IDOR closed.** The borrower-vs-pubkey authz match now runs whenever a
  pubkey is authenticated, regardless of `REQUIRE_AUTH` mode. Previously
  `REQUIRE_AUTH=warn` and `=off` skipped the check entirely.
- **Refuse to boot in production with `REQUIRE_AUTH=off`.** The deployer
  exits at startup if `NODE_ENV=production && REQUIRE_AUTH=off`.
- **Input validation on URL params and queries.** Path params (`loanId`,
  `fileId`, `borrower`) are validated as base58 / decimal-u64 / 16-hex via
  zod schemas before reaching the handler; bad shapes return 422.
- **Storage-layer pagination.** List endpoints stop iterating LevelDB after
  `max(limit + offset + 1, 1000)` matches, bounding memory and CPU per
  request regardless of DB size.
- **`exec(shell-string)` → `spawn(arg-array)`** for all `solana` CLI
  invocations (`program deploy`, `program close`, `rent`). Removes the
  shell entirely; future borrower-derived inputs can't accidentally become
  command injection.
- **Explicit HSTS** in the helmet config (1 year, includeSubDomains,
  preload-eligible).

### Tooling

- `npm run openapi:gen` in `deployer/` regenerates `deployer/openapi.json`
  from the route registry.
- `.github/workflows/deployer-api-contract.yml` regenerates the spec on
  every PR and requires a new `## API` entry in this file when the spec
  has changed.
- `.github/workflows/deployer-audit.yml` runs `npm audit --omit=dev
  --audit-level=high` on PRs that touch the deployer's `package.json` /
  `package-lock.json`, on pushes to `main`, and weekly.
