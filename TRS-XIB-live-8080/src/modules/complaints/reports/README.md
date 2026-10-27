# Complaint reports

Owns the `analysis-reports` catalog and `analysis-report-detail` route, the internal-report type tabs, report definitions, report-specific filters, nested column headers, selectable work-order rows, and export entry point. It remains part of the single `complaints/` ownership boundary; this subdirectory is a code boundary, not a separate staffing requirement.

Keep report definitions in `data.js`, interaction behavior in `index.js`, and scoped styles in `module.css`. Report filters render through the shared work-order filter controls and dictionaries exposed by the application context. Final business column definitions can replace each report's configuration without changing the catalog/detail renderer. A future backend integration should replace the sample-row adapter and export action through a reports service contract without reading ticket or subprocess page state.
