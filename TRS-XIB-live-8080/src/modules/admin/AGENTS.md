# Administration module guidance

- Administration routes live below this directory.
- Keep each independently reviewable capability in a subdirectory.
- Keep organization-tree UI state and actions inside `organizations/`; treat `XIB_PROTOTYPE_CONFIG.organizationTree` as shared read-only data.
- Keep permission role data and UI state inside `permissions/`.
- Keep user mock records in `users/data.js`; keep user list/detail state and actions in `users/index.js`.
- Preserve administrator and developer role access.
- Cover tab changes, toggles, modals, filtering, and row counts when those behaviors exist.
