# TRS-XIB repository guidance

This file is the durable working agreement for AI agents and human contributors.

## Product boundary

- This repository is an interactive front-end prototype, not a production banking system.
- Preserve the existing visual language, role views, workflows, sample-data coverage, and offline demonstration capability.
- Do not introduce real credentials, real customer data, or production endpoints.
- Prefer small, reviewable migrations over framework-wide rewrites.

## Start here

1. Read README.md and docs/ARCHITECTURE.md.
2. Install dependencies with npm install.
3. Start the prototype with npm run dev.
4. Before opening a PR, run npm run verify.
5. If source data or statistics source changed, run npm run build and include the generated files.

## Documentation and communication

- Human-facing documentation is written in Chinese: README.md, CONTRIBUTING.md, docs/模块分工.md, and the pull request template.
- AI-facing instructions and technical contracts are written in English: AGENTS.md files, docs/ARCHITECTURE.md, docs/MODULE-GUIDE.md, docs/MIGRATION-ROADMAP.md, and module README files.
- Keep README.md as the linked entry point for onboarding, project structure, features, collaboration, and integration guidance.
- This repository uses GitHub, so use the term PR. Use MR only when explaining the GitLab equivalent.
- PR titles, descriptions, and review discussion should be Chinese so the local team can follow them.
- Commit messages and code identifiers remain English. Use Conventional Commit prefixes.
- Do not duplicate durable AI rules into long prompts or Chinese onboarding prose. Put enforceable repository behavior in the nearest AGENTS.md.
- Update README.md and docs/模块分工.md whenever a top-level module ownership or migration status changes.

## Source-of-truth rules

- Edit data/forms/main-work-orders.json for main work-order entry and processing fields.
- Edit data/forms/subprocesses.json for subprocess and rectification fields.
- Edit data/forms/shared.json only for shared form metadata, storage contracts, and control labels.
- Never hand-edit data/form-schema.json; it is the generated compatibility aggregate.
- Edit data/workflow-schema.json for workflow states and approval rules.
- Edit data/status-tag-config.json for status colors.
- Edit data/customers.json for structured customer master data and customer merge relationships.
- Edit data/seed-data.json for demonstration records and ticket-time customer snapshots.
- Edit data/organization-tree.json for organizations.
- Edit src/core/app-config.js for navigation, page metadata, role profiles, and route permissions.
- Never hand-edit data/prototype-data.runtime.js.
- Keep field definitions together by business document. Do not split individual fields into separate files; split a subprocess into its own source only after repeated ownership conflicts justify it.
- Edit statistics-module.source.jsx for the statistics module.
- Never hand-edit statistics-module.js or statistics-module.css.
- statistics-embedded.html is still a build dependency. Do not delete or edit it casually.
- Never run tools/build-statistics-module.js --refresh-source during normal development. It can replace the editable statistics source.

## Architecture rules

- New business pages belong under src/modules/<module-name>/.
- Top-level navigation areas are the primary ownership boundary. Keep their code under the matching src/modules/<top-level-module>/ directory.
- Administration capabilities belong in subdirectories below src/modules/admin/.
- A module owns its views, event handling, styles, sample data, and tests.
- Do not assign simultaneous feature work to routes that still share app.js or statistics-module.source.jsx. Extract the boundary first.
- Register routes through the module registry instead of adding another global dispatcher when possible.
- Keep module selectors scoped below the module root.
- Do not add new document-wide IDs unless they are part of an explicit shared contract.
- Shared primitives belong under src/core or src/shared; business-specific behavior stays in its module.
- Avoid adding new responsibilities to app.js. Existing code is being migrated out gradually.
- Do not convert unrelated legacy code while implementing a focused feature.

## Generated files

Generated files are committed temporarily because the current deployment is static.

When a source file changes:

1. Run npm run build.
2. Review both source and generated diffs.
3. Run npm run check:generated.
4. Do not resolve generated-file conflicts manually. Update the branch from main and regenerate.

## Verification

Required for every change:

- npm run check:syntax
- npm run test:data
- npm run test:ui

Also run npm run check:generated when changing:

- files under data/forms/ or editable files under data/
- statistics-module.source.jsx
- tools/build-statistics-module.js
- tools/sync-prototype-data.js

If a check cannot run, state the exact reason in the PR. Do not claim it passed.

## Git workflow

- Never develop directly on main.
- Use one branch per task: feat/<topic>, fix/<topic>, refactor/<topic>, or docs/<topic>.
- Keep one PR focused on one module or one shared prerequisite.
- Separate shared-core changes from feature changes when practical.
- Use Conventional Commit prefixes: feat, fix, refactor, test, docs, chore.
- Write the PR title and body in Chinese; keep commit messages in English.
- Keep commit messages UTF-8 encoded. Never type commit messages from a GBK console; corrupted messages are unrecoverable.
- Prefer squash merge after CI and human product review pass.
- Delete merged feature branches (remote and local) after the PR is merged; enable GitHub's "automatically delete head branches" setting.
- Never force-push main or bypass required checks.

## Code review rules

### Behavior preservation

- Flag lost routes, role access, workflow actions, localStorage migrations, and broken linked-record navigation.
- Treat silent removal of an existing demo path as a regression.

### Module boundaries

- Flag new feature code added directly to app.js when a module extension point exists.
- Flag module code that reaches into another module's DOM or state without a documented interface.
- Flag duplicate route IDs, action names, element IDs, or storage keys.

### Data and generated artifacts

- Flag direct edits to generated files.
- Flag source changes without regenerated outputs.
- Flag schema changes without validation updates and storage-version consideration.

### UI stability

- Flag unscoped global CSS, unnecessary !important rules, and changes to shared selectors without cross-module regression coverage.
- Preserve keyboard access, labels, disabled-state explanations, and error feedback.

## Definition of done

A task is done only when:

- the intended page and role flow work;
- existing tests pass;
- new behavior has focused regression coverage;
- generated files are current;
- documentation reflects changed contracts;
- the PR explains what changed, how it was tested, and any remaining migration debt.
