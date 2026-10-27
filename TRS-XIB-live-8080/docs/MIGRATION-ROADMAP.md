# Migration roadmap

## Completed foundation

- Git baseline and private remote.
- Node and npm project metadata.
- Locked browser-test dependency.
- Cross-platform local server and browser lookup.
- CI, contribution guide, architecture guide, and AI instructions.
- Deterministic generated data metadata.

## Completed phase 1: extension boundary

- Added the browser module registry.
- Delegated route rendering, post-render binding, and actions to modules.
- Moved low-risk placeholder pages into a system-placeholders module.
- Preserved existing fallback behavior.

## Completed phase 2: configuration

- Moved navigation, page metadata, role profiles, and permissions into declarative core configuration.
- Added validation for duplicate routes, role profiles, permission entries, and missing metadata.
- Kept business modules from editing the main dispatcher for shared configuration.

## Phase 3: bounded business modules

Completed slices:

- Admin operations: scheduled jobs, notifications, and audit logs.
- Admin configuration: reminder settings and warning thresholds.
- Admin form configuration: form metadata, enum previews, field details, and modification history.
- Admin users: HR-synchronized user records, organization labels, list/detail rendering, and the legacy route alias.
- Admin permissions: administrator roles, business roles, permission tree, tabs, and role configuration.
- Admin organizations: organization tree, filtering, expansion state, selection, and detail rendering.
- Complaint reports: report catalog, report cards, and generation-modal behavior.
- Complaint monitoring: data-monitor compatibility route, warning list, warning details, and explicit related-ticket transition.
- Complaint inspections: inspection batches, ticket conclusions, supervision-letter lifecycle, persisted module state, and subprocess adapter.
- Complaint rectification list: role-aware tabs, workflow-state ordering, sorting, bulk selection, related tickets, and workflow action entry points.
- Complaint rectification form: creation/edit route, form layout, entry actions, and related-ticket picker behavior.
- Complaint rectification statistics: normalized statistics model, comparison calculations, trend-series calculations, and chart rendering.
- Complaint rectification detail: dedicated route ownership, detail composition, stage notice, related-ticket links, and transfer-record presentation.
- Declared top-level ownership directories for every primary navigation area.
- Split consumer review, education, and notifications into independently registered modules.

Suggested order:

1. Rectification staged field renderers, statistics-filter state, persistence, and workflow transitions.
2. Subprocesses.
3. Approvals.
4. Ticket creation, processing, query, and export.
5. Final shared-runtime cleanup after route extraction.

Each migration should be a separate PR.

## Phase 4: statistics

- Split statistics-module.source.jsx by page and shared component.
- Replace extraction of build dependencies from statistics-embedded.html.
- Use normal pinned npm dependencies.
- Generate deploy assets into a dedicated output directory.

## Phase 5: backend-ready boundaries

- Define repository interfaces for tickets, subprocesses, approvals, and organizations.
- Keep mock implementations for the prototype.
- Add API implementations behind the same interfaces when backend endpoints exist.
- Add request schemas and contract tests before removing mock data.

## Exit criteria

The migration is complete when:

- app.js is only a small compatibility bootstrap or removed;
- every route has one module owner;
- shared schemas and APIs are documented;
- generated artifacts are produced in CI;
- a new contributor can add a module without editing a multi-thousand-line file;
- front-end and backend developers can agree on validated contracts independently of mock UI state.
