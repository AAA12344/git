# Complaint inspections

Owns the `analysis-inspections` route, the direct inspection-ticket list and conclusions, supervision-letter creation, detail, feedback, and persisted supervision-letter state. Supervision letters are not subprocesses: they are created, viewed, and handled only inside intelligent inspection.

The frozen demonstration catalog lives in `data.js`; mutable view and letter state live behind `window.XIBComplaintInspections`. Notifications may deep-link to a letter through `openLetterInModule(id)` before navigating to this module.

`renderInspectionFindings(findings, { ticketId, ticketType, ticketStatus })` is shared by the ticket processing detail and inspection modal. Eligible complaint tickets use stable per-ticket demonstration states for the three independent checks: completed findings, generation in progress, or generation failure. A failed check can be retried independently; the in-session override changes only that check to “生成中...”. `bindInspectionRetry(root)` attaches this interaction to the supplied surface.

The modal confirmation and ticket lookup functions in module context remain transitional adapters until shared services replace the legacy application runtime.

The inspection-ticket list contains complaint and petition examples, resolves each department from the ticket record with a catalog fallback, and derives a single result status from the three checks: all complete and passed is “通过”, any completed failure is “不通过”, and every other combination is “-”. Only failed rows offer the send action. The result-status filter uses exact matching so “通过” does not also match “不通过”; the submission-time filter starts at 2015.

Only a work order whose latest inspection result is `不通过` can create a letter, and one work order can have only one letter. Drafts are visible and editable only to the sender. Sending freezes the inspection-result snapshot, sets the status to `处理中`, and makes `督导要求` read-only. The assigned handler can submit feedback and complete the letter; copied approvers can view it but never approve it. Statuses are limited to `草稿`, `处理中`, and `已办结`, with no claim operation. New IDs use `DH` followed by the Asia/Shanghai date and a four-digit daily sequence; persisted timestamp-style legacy IDs are migrated deterministically.
