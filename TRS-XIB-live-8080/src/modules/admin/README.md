# Administration

Top-level boundary for all routes under the administration navigation.

Extracted submodules:

- `organizations/`: organization tree, filtering, selection, and organization details;
- `config/`: reminder settings and warning thresholds;
- `operations/`: scheduled jobs, message templates, and audit logs;
- `form-config/`: form metadata, enum previews, field details, and change history;
- `users/`: HR-synchronized user list, organization labels, and user details;
- `permissions/`: administrator and business-role configuration.

All administration routes are now owned below this directory and can be developed independently by submodule. Shared organization records remain in `data/organization-tree.json` until a repository boundary is introduced.
