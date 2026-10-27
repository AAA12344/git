# Admin config module

Owns the `admin-config` route for reminder settings and warning thresholds.

The module keeps only its active tab as local UI state. Shared shell services such as the page header, modal actions, switch behavior, and toasts continue to come from the compatibility host.

Keep changes to this page inside this directory. Do not add its state or render branches back to `app.js`.
