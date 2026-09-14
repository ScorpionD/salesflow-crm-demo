# SalesFlow CRM — Figma before implementation

[View the editable Figma file](https://www.figma.com/design/tHCwZwV8Mv5jjPOOVf4UPG/SalesFlow-CRM--Portfolio-Design)

[Open the clickable prototype](https://www.figma.com/proto/tHCwZwV8Mv5jjPOOVf4UPG/SalesFlow-CRM--Portfolio-Design?node-id=1-2&starting-point-node-id=1%3A2&scaling=min-zoom&page-id=0%3A1)

Created on Figma Starter, shared as Anyone → Can view. No paid functionality was added. The business process and screen structure were designed before React implementation.

## Information architecture

Demo access → Dashboard → Contacts / Companies / Pipeline / Tasks / Reports / Activity / Team & settings. A deal detail brings account context, value, stage, owner, next action, notes, related tasks and audit history together.

The Figma file contains 10 desktop screens at 1440 px, a separate stage confirmation and 5 mobile adaptations at 390 px. A basic prototype connects role entry, dashboard, pipeline, deal detail, stage confirmation and return. The prototype is a static UX demonstration; actual data changes and RBAC run in the live application.

## Foundations

Inter type family with system-font fallback. Ink #172033, secondary #64748B, canvas #F7F8FA, surface #FFFFFF, border #E2E8F0, action #4F46E5, navigation #111827, success green and attention amber. Spacing uses 4/8/12/16/24/32 px, desktop sidebar 224 px, top bar 72 px, content gutter 32 px. Cards use 12 px radius, controls 8 px, with restrained shadows. Production icons use Lucide outlines; meaning is also expressed by labels.

The editable foundations sheet includes button, input, select, search, textarea, checkbox, badge, avatar, KPI card, table row, empty state, modal, drawer, toast, tabs, pipeline card, task item and activity item. Default, hover, disabled, error, loading and empty examples are included where applicable. This is a small local component system, not a published enterprise library.

The first foundations and dashboard were created in the Figma editor. Remaining screen layouts were authored as editable vector/text SVG assets and imported into native Figma frames before coding. Source assets remain in `design/screens`; these are design specifications, not screenshots of the live app.

## Responsive and interaction decisions

- Desktop uses a persistent navigation rail and six pipeline lanes. Mid-sized layouts wrap lanes to three columns.
- Mobile uses an accessible navigation drawer, stacked record cards and a stage selector rather than tiny drag targets.
- Stage movement uses an explicit dialog on every viewport. Won explains the notification; Lost requires a reason.
- Managers manage the workspace; representatives edit assigned records; viewers see read-only feedback. Authorization also runs on the server.
- Dialogs preserve in-progress edits when another tab changes data. Version checks prevent silent overwrites.
- Reports are calculated from saved records. No invented trends or guaranteed delivery claims appear in production.
- Production adds operational details to the static design: filtering, validation, safe archive constraints, session expiry and delivery status.

See `business-process.md` for domain rules. Screenshots and Figma/production comparisons are captured after live verification.
