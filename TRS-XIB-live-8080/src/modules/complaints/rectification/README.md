# Complaint rectification

Owns the `rectification-manage` list route, the `rectification-form` creation/edit route, and the `rectification-detail` route.

The module currently owns:

- role-aware list tabs, workflow-state ordering, sorting, bulk-selection markup, related-ticket links, and operation entry points;
- structured list columns for application time and planned completion time, including a consistent empty-value placeholder;
- creation/edit form layout, section anchors, list-to-form entry actions, related-ticket picker rendering/filtering, and form save/submit action routing;
- detail-page composition, stage guidance, related-ticket navigation markup, transfer-record presentation, and approval-mode layout in `detail.js`;
- statistics normalization, grouped comparison calculations, trend-series calculations, HTML/SVG chart rendering, and output escaping in `statistics.js`.

Transitional contracts:

- list rows are cloned through `getRectificationRows()`;
- the form reads a cloned form model through `getRectificationFormModel()`;
- detail data is cloned through `getRectificationDetailModel()`;
- shared legacy field controls are rendered through `renderRectificationFormField()`, `renderRectificationReadonlySections()`, and `renderRectificationProcessingEditor()` so schema-driven pickers, uploads, validation, and staged editing remain behavior-compatible;
- workflow rejection, flow visualization, and approval controls are supplied through explicit rectification adapters rather than direct access to legacy state;
- form persistence and workflow submission still use explicit `saveRectificationDraft()` and `submitRectification()` context adapters;
- the five person-selecting workflow handoffs are declared in `data.js`; each selected approver is persisted in the rectification record and assigned in the shared work-pool model;
- stored statistics and current filter values are still supplied by the legacy runtime to `XIBComplaintRectificationStatistics`.

The detail route and its page composition are independently assignable. Staged field renderers, approval behavior, statistics-filter UI state, row storage, workflow transitions, and persistence remain in the legacy runtime; changes to those adapters still require coordination with the architecture owner.
