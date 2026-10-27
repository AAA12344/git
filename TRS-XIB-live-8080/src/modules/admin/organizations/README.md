# Admin organizations

Owns the `admin-org` route, organization-tree filtering, selection, expansion state, and organization detail rendering.

The canonical mock hierarchy remains in `data/organization-tree.json` and is exposed through `XIB_PROTOTYPE_CONFIG.organizationTree`. Other modules may resolve organization labels from that shared read-only dataset, but must not depend on this module's DOM or internal UI state.

Keep organization-page behavior and focused tests inside this directory. A future backend integration should replace the shared organization data source behind a documented repository contract while preserving an offline mock implementation.
