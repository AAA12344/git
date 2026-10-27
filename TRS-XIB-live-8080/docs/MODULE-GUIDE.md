# Module guide

## Directory

Create new business work under its top-level navigation boundary:

    src/modules/<top-level-module>/
      AGENTS.md          # optional local AI rules
      README.md          # English technical status
      index.js           # when the top-level route is small
      <submodule>/       # independently assignable capability
        index.js
        views.js
        events.js
        state.js
        module.css
        README.md

Examples:

    src/modules/education/index.js
    src/modules/notifications/index.js
    src/modules/admin/config/index.js
    src/modules/admin/operations/index.js

Small modules may begin with only index.js and module.css, then split as they grow.
A README-only boundary records planned ownership; it is not an extracted runtime module.

## Registration contract

The browser exposes window.XIBModuleRegistry.

A module can register:

- name: stable module identifier;
- routes: route IDs owned by the module;
- render: returns HTML for an owned route;
- afterRender: binds behavior below the current page root;
- handleAction: handles module-specific data-action values.

Every hook receives a context supplied by app.js. Use context functions instead of reaching into legacy internals. The transitional `openTicketDetail(ticketId, options)` adapter is the explicit cross-route contract for complaint modules that need to open a ticket while preserving documented source context such as `warningContextId`. Inspection dialogs also use the transitional `findTicketRow`, `persistWorkflowState`, `systemTimestamp`, `showValidationError`, and `openSubmissionConfirmation` context adapters. The inspection module owns supervision-letter state behind `window.XIBComplaintInspections`; the legacy subprocess page may consume only its documented row and action methods. The rectification module reads cloned legacy rows through `getRectificationRows()` and a cloned creation/edit model through `getRectificationFormModel()`. Shared schema-driven controls temporarily render through `renderRectificationFormField()`, while persistence and workflow submission use explicit context adapters. Pure statistics normalization and chart rendering live behind `window.XIBComplaintRectificationStatistics`; the legacy detail may pass cloned stored values and filter state but must not reimplement statistics calculations. Do not mutate cloned rows or add new direct legacy-state access inside the module.

Example shape:

    window.XIBModuleRegistry.register({
      name: "example",
      routes: ["example-home"],
      render(page, context) {
        return "<section class='page xib-module-example'>...</section>";
      },
      afterRender(root, page, context) {
        // Bind only below root.
      },
      handleAction(action, payload, context) {
        if (action !== "example-refresh") return false;
        context.toast("Updated");
        return true;
      }
    });

## Loading a module

Until the build pipeline owns module discovery, add each implemented module script to
index.html after src/core/module-registry.js and before app.js. Keep this list in
dependency order.

Add every module entry file to check:syntax and add a focused contract or browser
test. The registry test rejects duplicate route ownership.

## Route rules

- Route IDs are lowercase kebab-case.
- A route has exactly one owner.
- Do not reuse a route as an action name.
- Document role access in the module README.
- Declare navigation, page metadata, role profiles, and route access in src/core/app-config.js.

## Action rules

- Prefix module actions, for example notice-open or education-publish.
- Return true only when the action was handled.
- Keep action payload in data attributes or a structured object.
- Avoid a long global if/else dispatcher.

## DOM rules

- Use one module root class.
- Scope all queries below the root argument.
- Prefer data attributes for behavior hooks.
- Avoid globally unique IDs unless required by accessibility references.
- Clean up window or document listeners when the module is unmounted.

## State rules

- Keep temporary UI state inside the module.
- Put durable cross-route state behind an explicit persistence adapter.
- Do not write directly to another module's state.
- Version localStorage structures when compatibility changes.

## Styling rules

- Put module styles next to the module.
- Prefix selectors with the module root.
- Reuse existing design tokens and ui/css/xib-components.css.
- Do not solve conflicts by adding !important unless the shared component contract requires it.

## Tests

At minimum, cover:

- the route renders;
- expected text or controls exist;
- the primary interaction works;
- switching away and back does not duplicate listeners;
- affected roles have the expected access.

## Migration from app.js

When moving an existing page:

1. Record its current route, role access, actions, and storage keys.
2. Add regression coverage before moving code.
3. Register the module route.
4. Move view and event behavior.
5. Keep a temporary context adapter if the module still needs legacy data.
6. Remove the old route branch and action branch.
7. Run the full regression suite.
