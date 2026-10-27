# Admin operations

Owns three implemented administrative routes:

- `admin-jobs`
- `admin-notify`
- `admin-audit`

The module owns its demo datasets, audit-tab state, rendering, and route-specific
actions. Shared shell services such as page headers, status tags, pagination,
modals, and toasts are received through the module context.

Role access remains declared in `src/core/app-config.js`. The pages are available
to the admin and developer roles.
