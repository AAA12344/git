# Admin users

Owns the `admin-user` route and the legacy `user-manage` alias. `data.js` contains immutable HR-sync mock records; `index.js` owns list/detail rendering and module actions. Organization labels are resolved read-only from `XIB_PROTOTYPE_CONFIG.organizationTree`.

Keep user data, UI behavior, and focused tests in this directory boundary. Backend integration should replace the data source behind a documented repository contract without coupling this module to the organization page DOM or internal state.
