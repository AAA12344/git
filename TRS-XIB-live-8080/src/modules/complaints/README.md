# Complaints

Top-level ownership boundary for ticket, subprocess, approval, rectification, inspection, warning, and complaint-report routes. One person or maintainer group may own this entire directory even though the code is split into internal business capabilities.

Extracted shared domain services and submodules:

- `work-pool.js`: role-aware workbench, organization-pool, subordinate-pool status matrices, and assignment ownership.
- `customer-repository.js`: structured customer master-data lookup and ticket linkage.

- `reports/`: complaint report catalog and report-generation interaction.
- `monitoring/`: data-monitor compatibility page, intelligent warnings, warning details, and related-ticket transitions.
- `inspections/`: intelligent inspection batches, inspection-ticket conclusions, and supervision-letter workflows.
- `rectification/`: rectification management list, creation/edit form route, related-ticket picker, statistics model/charts, role-aware tabs, sorting, selection, and workflow action entry points.

Planned internal boundaries:

- `tickets/`: creation, drafts, processing, details, and ticket export;
- `subprocesses/`: subprocess creation, processing, and details;
- `approvals/`: ticket, subprocess, and request approvals;
- `rectification/` (remaining): staged processing, approval details, statistics-filter state, persistence, and transitions;

Most implementation still lives in `app.js`. Do not assign simultaneous work to legacy route groups until each group has been extracted with its state and actions. Internal directories improve dependency boundaries; they do not require separate CODEOWNERS or separate staff.

## Ticket acceptance SMS and smart dispatch (legacy adapter)

- Ticket lists do not render `抄送` beside the ticket type. Copy recipients and copy-notification behavior remain independent business data; only rectification keeps a `是否抄送` search condition.

- `data/workflow-schema.json:approvalRules.ticketReviewChannels` defines intake channels that require review independently of the creator's role. Telephone complaints defer the existing acceptance-SMS confirmation from creation to successful review. Other complaint intake channels retain their submission-time SMS flow; praise/suggestion and subprocess review do not gain a new SMS step.
- The legacy adapter shares one confirmation dialog and contact-record writer between submission and review. Approval is committed only after confirmation; cancellation/rejection never sends a message. A successful send records the actual ticket ID, recipient, template, and `triggerStage` in `contactRecordsByTicket`. Missing recipients cannot be replaced with a fabricated phone number.
- New review tasks receive reviewer ownership. After review passes, the ticket returns to the receiving institution as unclaimed `待处理`, not a claimed handler task.
- `data/forms/main-work-orders.json` defines smart-dispatch department filtering via `optionsByInstitution.departmentNameIncludes` and `emptyForSubbranch`. Options come only from enabled direct departments in the selected institution's organization-tree record. Subbranch dispatch clears/disables the department and removes its required marker. Demo filling and AI suggestions use the same rule. Historical snapshots and unrelated transfer-department options are not rewritten.
- Focused regression: `npm run test:phone-review-sms` and `npm run test:assignment-ui`. Both are included in `npm run verify`.
