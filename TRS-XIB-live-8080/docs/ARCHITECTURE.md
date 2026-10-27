# Architecture

## Current state

The repository is in a controlled transition from a single-file prototype to a modular front-end.

The application currently has three layers:

1. Static shell and shared UI assets.
2. Legacy application runtime in app.js and styles.css.
3. A React-based statistics module mounted through Shadow DOM.

Structured JSON supplies forms, workflows, organizations, status colors, and demo records. Build scripts create browser-ready JavaScript from these sources.

## Runtime flow

    index.html
      -> data/prototype-data.runtime.js
      -> data/china-geojson.runtime.js
      -> local React runtime
      -> statistics-module.js
      -> src/core/app-config.js
      -> src/core/module-registry.js
      -> src/modules/*
      -> app.js

The legacy runtime remains last so it can consume registered modules while migration proceeds.

## Source and generated files

Editable sources:

- app.js during the transition
- styles.css during the transition
- src/**
- data/*.json
- statistics-module.source.jsx

Generated files:

- data/prototype-data.runtime.js
- data/china-geojson.runtime.js
- statistics-module.js
- statistics-module.css
- ui/vendor/react.production.min.js
- ui/vendor/react-dom.production.min.js

Legacy build input:

- statistics-embedded.html

The legacy input is not loaded by index.html, but the statistics build still extracts Babel, Tailwind, React, and map data from it.

## Module boundary

Each module should own:

- route IDs;
- view rendering;
- module-local state;
- event handling;
- CSS scoped to its root;
- demo data adapters;
- focused tests.

Modules should communicate through explicit context functions, not by querying another module's DOM.

## Shared core

src/core contains small framework-independent contracts:

- validated navigation, page metadata, role profiles, and route permissions;
- module registry;
- route and action dispatch extension points;
- future store, router, and persistence adapters.

The core must not contain ticket-, approval-, statistics-, or admin-specific business rules.

## Top-level ownership boundaries

The directory directly below `src/modules/` matches a top-level navigation area:

- `home/`;
- `complaints/`;
- `consumer-review/`;
- `statistics/`;
- `report-center/`;
- `education/`;
- `notifications/`;
- `admin/`.

Administration is intentionally nested because its pages are independently assignable capabilities. Extracted implementations currently live in `admin/config/` and `admin/operations/`.

A boundary README may exist before its runtime is extracted. This records the intended owner without pretending the migration is complete. Contributors must check the status in the directory README and `docs/模块分工.md` before starting parallel work.

Do not assign simultaneous work to route groups that still share `app.js` or `statistics-module.source.jsx`. Git can merge text, but it cannot prove that shared state, actions, or data contracts remain semantically compatible.

## Transitional legacy adapter

app.js still owns most state and rendering. During migration it asks the registry whether a registered module can:

- render a route;
- bind after rendering;
- handle an action.

If no module handles the request, app.js falls back to its existing behavior. This makes migration incremental and keeps every commit runnable.

## CSS strategy

New modules must use a module root such as .xib-module-notice and scope selectors beneath it.

Do not add new generic selectors such as:

- .panel
- .table
- .card
- button
- input

Shared visual primitives should be added deliberately under src/shared and reviewed across representative pages.

## Data strategy

JSON files remain the source of truth during the prototype phase. Runtime JavaScript exists only to support static and file-based loading.

When a schema changes:

1. Update the source JSON.
2. Update validation rules.
3. Consider whether storageVersion must increase.
4. Regenerate runtime data.
5. Run data and UI tests.

### Subprocess contract

Subprocess behavior is split across three sources of truth:

- `data/forms/subprocesses.json` owns common and type-specific base fields, entry/process sections, approval rules, and supplement sections.
- `data/workflow-schema.json` owns the canonical nine-state order, transitions, and `typeStatusMatrix` applicability per subprocess type.
- `data/seed-data.json` owns representative records for every supported state and UI path.

The reviewed workbook is an external requirements input, not a runtime dependency. Translate it into the JSON contract and record the reviewed sheet/range in `subprocesses.source`. Never parse the workbook in the browser.

Customer-service review applies only to withdrawal, void, and correction subprocesses linked to telephone or online customer-service tickets. Review approval UI is rendered at the end of the processing tab, never on the basic-information tab. Use `npm run test:subprocess-contract` for exact matrix/config validation and `npm run test:supplement` for create, review, approval-placement, and supplement browser coverage.

## Migration principle

Migrate one bounded capability at a time:

1. Add or confirm a regression test.
2. Introduce the module boundary.
3. Move behavior without redesigning it.
4. Verify all roles and linked navigation.
5. Remove the legacy implementation only after the module is active.

The target is maintainability and parallel work, not maximum framework complexity.
