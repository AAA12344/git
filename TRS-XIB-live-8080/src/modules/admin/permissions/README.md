# Admin permissions

Owns the `admin-permission` route, administrator and business-role mock data, tab state, role configuration state, permission-tree rendering, and module actions. Navigation labels are read from the immutable application configuration rather than copied into this module.

Keep role data in `data.js` and view behavior in `index.js`. A production backend must enforce authorization server-side; these browser-side permissions are prototype presentation data only.
