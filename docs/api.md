# SalesFlow REST API

Same-origin `/api`. JSON input/output. Successful creation returns 201; normal reads/updates return 200. Error shape: `{ "error": { "code": "CONFLICT", "message": "...", "fields": {} }, "requestId": "..." }`. Never rely on UI controls as authorization.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/session` | Create anonymous demo workspace; body `{role}` |
| GET | `/session` | Restore current session/persona/CSRF token |
| POST | `/session/role` | Deliberate demo role switch, same workspace |
| POST | `/session/logout` | Invalidate session |
| GET | `/bootstrap` | Current records, members, stages, reports, recent activity and delivery status |
| GET | `/contacts`, `/companies`, `/deals`, `/tasks` | Paginated records |
| GET | `/{kind}/{id}` | Record, related notes and activity |
| POST | `/{kind}` | Validated create |
| PATCH | `/{kind}/{id}` | Edit; `version` is required |
| POST | `/{kind}/{id}/archive` | Safe archive for contacts/companies/deals; `{version}` |
| POST | `/deals/{id}/stage` | `{stage, version, lost_reason?}` |
| POST | `/{kind}/{id}/notes` | `{body}` for contact/company/deal |
| PATCH | `/team/{id}` | Manager-only `{name, active, version}` |
| GET | `/reports` | Saved-data metrics |
| GET | `/activity` | Latest 100 workspace events |
| GET | `/events` | Authenticated SSE, `sync` event and heartbeat |
| GET | `/health` | Process health via protected gateway |

Lists accept `search` (up to 100 chars), `owner`, `status` (deal stage for deals), `archived` (`true/false`), `overdue` (`true/false`, tasks only), `page` (1–1000) and `pageSize` (1–50). Response: `{items,total,page,pageSize}`. Filtering precedes pagination. Searches use names for companies/contacts and titles for tasks/deals.

Writes require exact allowed `Origin`, JSON content and `X-CSRF-Token` from the active session, except initial session creation. Production also requires the gateway-only origin secret. Browser cookies are sent same-origin and cannot be read from JavaScript.

Every contact/company/deal/task write includes an active in-workspace `owner_id`. Representatives may assign only themselves. Deal `company_id` is required; optional `contact_id` must belong to that company. Tasks link to at most one `company_id`, `contact_id` or `deal_id`. Task `due_at` is an ISO timestamp; deal `expected_close` is a valid `YYYY-MM-DD` calendar date. Values are USD numbers from 0 to 100,000,000 with cent precision.

Common errors: 401 missing/expired session, 403 permission/Origin/CSRF, 404 inaccessible record, 409 stale version/duplicate/unsafe archive, 413 request size, 422 validation, 429 rate or stream limit, 503 gateway upstream unavailable. Refetch the record after a 409 and let the user review changes before saving again.

Private n8n endpoints are `/internal/automation/claim` and `/internal/automation/complete`. They accept the private automation header and are never routed by the public Worker. Claim uses `{eventId,workspaceId}`; completion adds `{claim,delivered,receipt}`. Privileged identifiers/tokens are excluded from public automation status.
