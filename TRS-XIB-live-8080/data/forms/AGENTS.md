# Form schema source guidance

This directory is the editable source of truth for form field definitions.

## Ownership boundaries

- Edit `main-work-orders.json` for main work-order entry and processing fields.
- Edit `subprocesses.json` for subprocess and rectification fields.
- Edit `shared.json` only for metadata, storage contracts, and shared control labels.
- Keep all fields for one business document together. Do not create one file per field.
- Add separate subprocess source files only when repeated merge conflicts show a real independent ownership boundary.

## Generated compatibility files

- Never hand-edit `../form-schema.json`.
- Never hand-edit `../prototype-data.runtime.js`.
- Run `npm run build:data` after changing a source file; it regenerates both compatibility artifacts.

## Schema changes

- Preserve stable field names unless a coordinated data migration is part of the task.
- Define visibility, required rules, defaults, persistence stage, detail display, approval display, and export impact together.
- Update `data/seed-data.json`, `data/workflow-schema.json`, validators, and the storage version when the changed contract requires them.
- Run `npm run test:form-schema`, `npm run check:generated`, and `npm run verify` before opening a PR.
