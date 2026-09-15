# Verification record

## Public connectivity repair — September 15, 2026

The public gateway returned 503 while the API/database health checks and tunnel connections were healthy. Tunnel logs showed attempts to reach an obsolete private address. Resolving the generic `api` hostname from the tunnel's Docker network returned a different, reachable address; an unauthenticated request reached the expected origin protection (403).

The VPC service now uses the unique `salesflow-api.internal` alias, scoped to the shared edge network, and explicitly uses Docker DNS at `127.0.0.11` through the existing SalesFlow tunnel. Only the SalesFlow API container was recreated to apply the alias; database volumes and the other applications were not changed. Deployment now checks the public health endpoint as well as container status.

Verification after repair:

- Public `/api/health`: 200, `status: ok`.
- New Manager, Representative and Viewer sessions: 201; session restoration, bootstrap, paginated contacts and logout: 200 for each role.
- Existing Chrome session restored its previous dashboard and seven contacts, including the earlier fictional Sam Taylor record; the Contacts page remained available after reload.
- 35 domain/frontend/gateway tests passed; production build passed. The unchanged 25-test PostgreSQL suite was not rerun for this network configuration repair.

The application UI and business logic were unchanged. The original full verification below records the earlier 60-test run separately.

Date: **September 14, 2026**. Target: [public Cloudflare Pages deployment](https://salesflow-crm-demo-7id.pages.dev/).

## Automated checks

| Suite | Passed | Coverage |
|---|---:|---|
| CRM domain | 18 | Roles, stages, money, dates, ownership rules and report calculations |
| Frontend/service | 9 | Role entry, loading/errors, required fields, stage confirmation, conflicts and CSRF requests |
| Gateway | 8 | Origin/route/header protection, rate-limit handling and forwarding |
| PostgreSQL integration | 25 | Actual restricted-role database tests, RLS, tenant isolation, CRUD, tasks, audit, reports, conflicts, SSE and notification idempotency |
| **Total** | **60** | No database mocks in the PostgreSQL suite |

The full suite passed against a dedicated PostgreSQL test database on the isolated deployment and in [GitHub Actions](https://github.com/ScorpionD/salesflow-crm-demo/actions/workflows/ci.yml). A local run without `TEST_DATABASE_URL` reports 35 passed and 25 explicitly skipped; this is not presented as a complete database test run. Lint/type checking and the production build pass. CI repeats all 60 checks, lint and build for `main` pushes and pull requests.

The integration role is checked for `NOSUPERUSER` and `NOBYPASSRLS`. Tests refuse a database name without the `_test` suffix and clean up only their own workspaces.

## Real browser scenario

- Entered as Sales Manager through the public URL and received a seeded private workspace.
- Created **Sam Taylor** (`sam.taylor@example.com`), linked the contact to Alder Studio, found it through search and changed its status from Lead to Active. The detail page and company relationship list showed the saved record and audit events.
- Created **Westfield Services** with fictional business details, opened its detail and safely archived it. The history retained the create/archive events.
- Opened **Alder CRM rollout** in two browser tabs. Moving it from Proposal to Negotiation updated the second tab without a page reload. The second tab also received a saved note, a Won transition and completion of the linked follow-up task.
- Added a deal note, moved the opportunity to Won and completed **Follow up on Alder proposal**. The overdue count changed from 3 to 2.
- Verified the reports recalculated from the stored win: open pipeline **$72,500**, won revenue **$34,500**, **5 Won / 2 Lost**, conversion **71%**. These figures are scenario results, not performance or revenue claims.
- Reloaded the page. The session, contact, stage, note, task completion and delivery result remained available.
- Switched to Representative and observed Edit only for assigned contacts; other records offered View. Viewer displayed a read-only notice and no write controls. Server-side denial is independently covered by PostgreSQL/API permission tests.
- Opened a separate browser session. It received the original **$84,500** pipeline, **4 wins**, **3 overdue tasks** and **6 contacts**, without Sam Taylor or the first visitor's edits. API integration tests also attempt cross-workspace references under RLS.

Pagination, invalid data, blocked archive dependencies, assignment rules and simultaneous conflicting edits are covered by the real PostgreSQL API suite. This report distinguishes those automated checks from the manual browser scenario above.

## Real automation delivery

The public Won action passed through the deployed API, PostgreSQL outbox, active isolated n8n workflow and Telegram. The workflow returned a delivery receipt, and the public Reports/Team screen displayed **Telegram delivered**. The status persisted after page reload. [Actual capture](../media/07-reports-automation.png).

The normal automated suite does not send Telegram messages. It checks concurrent claim suppression, idempotent receipt recording and uncertain-delivery behavior. The live test used one fictional Won notification. Repeating an existing event is suppressed; reopening and winning again creates a distinct event.

## Responsive and design checks

Checked **320, 390, 768 and 1440 px** layouts, including navigation, dashboard, contacts, pipeline, detail, tasks, reports and dialogs. Key mobile screens were captured at 390 px. Fixed the entry/navigation scroll position, closed mobile navigation accessibility, narrow filter layout and horizontal overflow at 320 px. Task detail includes a link back to its related opportunity.

Figma was created before implementation on the free Starter plan. The file contains the native foundations/dashboard plus editable vector/text desktop and mobile specifications. View-only sharing was verified. The prototype was exercised through role entry → dashboard → pipeline → deal detail → stage confirmation → return.

Compared the dark rail, indigo actions, neutral canvas, typography hierarchy, spacing, cards and desktop/mobile information structure. Production adds necessary validation and operational controls. Three [comparison boards](../media/README.md) show actual Figma and production captures, including a mobile screen.

## Deployment and security evidence

- Cloudflare Pages is connected to the public GitHub repository, production branch `main`, build `npm run build`, output `dist`. A GitHub push triggered a successful Pages build and publication.
- Cloudflare assigned the public hostname **salesflow-crm-demo-7id.pages.dev**; the gateway and API enforce that exact origin. The shorter unsuffixed hostname is not this deployment.
- The Worker forwards into a private VPC/Tunnel service. API, PostgreSQL and n8n use separate SalesFlow containers, networks and volumes, with no public host ports in the production configuration.
- Repository text, Git history and the built frontend were checked for actual deployment secrets and common credential patterns. No deployment credentials were found. Public ephemeral CI passwords are only for its disposable PostgreSQL service.
- This is a focused portfolio verification, not a formal penetration test, high-availability exercise or load certification. Existing portfolio projects were not modified and no paid service was added.

## Limits to keep visible

The workspace is disposable after 24 hours, with fictional personas and bounded records. Persona switching is intentional demo access, not production identity authentication. There is one API instance, one currency, six fixed stages and one Won automation. There is no OAuth, live billing, CRM/email/calendar integration, enterprise onboarding or HA/backup service in this MVP. Telegram availability is external; ambiguous delivery is reported honestly rather than blindly retried.
