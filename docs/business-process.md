# SalesFlow CRM — business process and design brief

SalesFlow is a working portfolio demonstration for a small B2B sales team. All companies, people and values are fictional. The design is created in Figma before implementing the React application.

## Process

Lead/contact → company → deal → pipeline stage → activities/tasks → Won or Lost.

1. Create a contact with name, email, source, status and owner; optionally link an active company in the same workspace. Leads are contact records with status Lead, avoiding a duplicate lead database.
2. Create a deal with a title, nonnegative value in USD, company, optional contact, owner, expected close date and priority. A selected contact must belong to the selected company. Every relationship stays inside the current workspace.
3. Move deals through New, Qualified, Proposal and Negotiation. Marking Won or Lost is an explicit action. Lost requires a reason; closed deals store a closure timestamp. Reopening is a manager-only action and clears closure metadata. Direct moves among open stages are allowed; the application does not invent restrictive enterprise approvals.
4. Create tasks for a contact, company or deal, with an assignee, due date and priority. Tasks progress Open → In Progress → Completed. An incomplete task with a due date in the past is overdue.
5. Record creation, updates, assignments, stage changes, notes and task completion in an immutable activity history, within the same database transaction as the change.
6. A Won transition queues one notification event. A separate n8n workflow sends the deal title, company, value, owner and time to Telegram. Repeated delivery requests are deduplicated by event ID. Ambiguous delivery is surfaced rather than silently retried into duplicate messages.

## Roles and workspace isolation

- Sales Manager: manages the workspace's contacts, companies, deals, tasks, team assignments, reports and automation. Demo team management edits fictional member names and active status; it sends no invitations.
- Sales Representative: reads workspace context and works on records assigned to their fictional user. Can create records assigned to self, edit owned records, add notes to permitted records, move owned open deals and manage own tasks. Cannot reassign ownership, manage team members or reopen closed deals.
- Viewer: read-only access to the current demo workspace, including reports and activity.

One-click entry creates a private temporary workspace with fictional seed records. The session is restored with a secure HttpOnly cookie. Switching a demo role changes the current demonstration persona, not another visitor's access. Workspaces expire after 24 hours. Two tabs of the same session share the dataset; a second private session cannot access it.

## Information architecture

Demo access → Dashboard / Contacts / Companies / Pipeline / Tasks / Reports / Activity / Team & Settings.

Contact, company and deal details use consistent drawers or dedicated detail panels. The pipeline stage can be changed with an accessible explicit action; drag-and-drop is optional. Confirm archive and terminal stage actions, show validation next to fields, and keep unsaved edits intact on conflict.

## Useful metrics

- Open pipeline value: sum of active, nonarchived deals in open stages.
- Open deals: number of deals in those stages.
- Won deals and revenue: count and value of Won deals.
- Closed-deal conversion: Won / (Won + Lost), shown as unavailable when no deals are closed.
- Overdue and upcoming tasks: derived from actual due dates and incomplete status.
- Pipeline by stage, won/lost breakdown and sales by owner: computed from the current workspace's data.

## Realtime, concurrency and trust

SSE emits workspace-scoped change events after commit. Clients refresh relevant data without reloading the page and reconnect after interruption. Last-Event-ID supports resynchronization. Optimistic version checks return an explicit conflict when a record changed after a form was opened; stale edits do not silently overwrite newer data.

Archived companies/contacts remain identifiable in history. Archiving is rejected when it would leave an open deal linked to an inactive business entity. Closed deals remain available for reports and history. Database transactions, foreign keys and scoped queries protect relational integrity.

## Visual direction

Distinct from a generic operations dashboard: a calm editorial CRM with an ivory canvas, white cards, ink text and indigo accents. Warm amber indicates due work, emerald Won, slate Lost. Compact readable tables, clear Kanban columns and a deal activity rail put sales actions first. Typography: Inter; 4px spacing base; 12-column desktop grid; 12px card radius; subtle borders and restrained shadows.

Desktop frames: 1440px. Mobile: 390px, with explicit Dashboard, Contacts, Pipeline, Deal detail and Tasks screens. Sidebar becomes a menu, tables become readable cards and pipeline stages become a selectable lane. Review at 320/390/768/1440 during implementation.

## Figma deliverables

File: SalesFlow CRM — Portfolio Design. Compact design system with colors, typography, spacing/grid, radii/shadows/icons and 18 component families: Button, Input, Select, Search, Textarea, Checkbox, Badge, Avatar, KPI card, Table row, Empty state, Modal, Drawer, Toast, Tabs, Pipeline card, Task item and Activity item, with default, hover, disabled, error, loading and empty examples where relevant.

Ten desktop screens: demo access, dashboard, contacts, companies, pipeline, deal detail, tasks, reports, activity, team/settings. Five key mobile screens. Prototype: login → dashboard → pipeline → deal detail → stage/task action → back. Public view-only sharing only; no private business data.

## MVP boundaries

No paid services, OAuth, email, real customer data or enterprise configuration. Future integrations (HubSpot, Salesforce, Gmail, Outlook, Slack, WhatsApp, calendars, Stripe and custom APIs) are described as customization possibilities only.
