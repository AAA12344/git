# Home

Owns the operational home route `home-tasks` and its module-owned demo data and UI state.

Migration status: the task inbox is independently registered from this directory. The `overview` data dashboard remains rendered by the legacy statistics bundle and must still be coordinated through `statistics-module.source.jsx`.

The development organization exposes `developer`, `operator`, `handler`, and `approver` task-inbox views through `taskInboxRole`. This view role currently affects only the home task inbox and notification center; it must not be treated as system-wide authorization.

Home task rows may contain only actionable work items:

- tickets and subprocesses, including supervision letters;
- rectification work orders;
- ticket, subprocess, SMS, export, and rectification approvals.
- consumer-protection review tasks linked to the consumer-review module.

Notification content is owned by `src/modules/notifications/data.js`; home consumes that module's public summary data without owning notification state.

The work overview computes progress and on-time completion from module-owned structured demo records. Operator, handler, and analyst views use personal records; reviewer and approver views use the current institution pool. Drafts are excluded from progress totals.
