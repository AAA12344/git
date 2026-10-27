# Top-level module boundaries

Each directory below corresponds to a top-level navigation area and is the default ownership boundary for parallel work.

| Directory | Top-level area | Current implementation |
| --- | --- | --- |
| `home/` | Home | Pending extraction from the statistics bundle |
| `complaints/` | Complaint management | Mostly pending extraction from `app.js` |
| `consumer-review/` | Consumer review | Independent registered placeholder |
| `statistics/` | Statistics | Maintained in `statistics-module.source.jsx` during transition |
| `report-center/` | Report center | Pending extraction from the statistics bundle |
| `education/` | Education | Independent registered placeholder |
| `notifications/` | Notifications | Independent registered placeholder |
| `admin/` | Administration | Partially extracted into submodules |

Read the nearest `AGENTS.md` before editing a module. A folder that only contains a README is a declared target boundary, not a claim that its runtime has already been extracted.

Do not assign parallel work to routes that still share `app.js` or `statistics-module.source.jsx`. Extract the route group first, merge it, and only then let contributors work independently.
