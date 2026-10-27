# PR27 Batch Import Validation Implementation Plan

**Goal:** Complete PR27's batch-import rules without dropping its countersign changes.

**Architecture:** Keep the current browser-side XLSX parser. Separate workbook-level blocking validation from row/field-level non-blocking validation, retain sanitized row data for draft generation, and surface each field error on the editable draft form. Reuse the existing ticket submission validator for final creation.

**Tasks:**

1. Extend the browser test with real minimal XLSX fixtures for invalid headers, duplicate headers, and invalid/missing row fields; verify blocking versus draft generation behavior.
2. Parse exact template headers, reject missing/unknown/duplicate headers, and remove the obsolete 10,000-row rule.
3. Sanitize invalid field values, generate drafts from every parsed row, hydrate imported drafts into the ticket form, and render red inline field errors that clear when corrected.
4. Strengthen the countersign regression test for department selection after institution changes.
5. Run focused tests, full verification, generated-file checks, and deployment build; then commit and push the existing PR27 branch.
