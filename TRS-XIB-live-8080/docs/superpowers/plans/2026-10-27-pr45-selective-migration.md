# PR #45 Selective Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update PR #45 onto the latest `main` while retaining only the field-table-driven subprocess fields, status examples, validation, and text-length rules that remain valid.

**Architecture:** Treat the current `main` as authoritative for intelligent inspection, supervision letters, permissions, and related-record layouts. Migrate the canonical subprocess schema and seed examples first, regenerate derived data, then add only the minimum rendering support required by the schema. Guard the migration with focused contract tests before running repository-wide verification.

**Tech Stack:** Static HTML/CSS/JavaScript prototype, JSON schemas and seed data, Node.js assertion scripts, Playwright UI tests.

**Spec:** `data/forms/subprocesses.json` and the corrected field-table rules already represented by PR #45 commit `9ec661b`.

## Global Constraints

- Latest `main` remains authoritative for intelligent inspection and supervision-letter behavior.
- Do not restore supervision letters under subprocess management.
- Preserve PR #46 related-record alignment and PR #49 permission/attachment rules.
- Attachment limits remain 30 files and 100 MB per file.
- Generated JSON/runtime data must be rebuilt from source files, never hand-edited independently.

---

### Task 1: Identify residual PR #45 rules

**Files:**
- Inspect: `data/forms/subprocesses.json`
- Inspect: `app.js`
- Inspect: `tools/test-field-table-status-rules.js`
- Inspect: `tools/validate-subprocess-contract.js`

**Interfaces:**
- Consumes: PR #45 commits `0fca71e`, `d92ce72`, `5f70db7`, `9ec661b`.
- Produces: an exact residual-rule list excluding behavior already superseded on `main`.

- [ ] Compare each source file against the latest `main` and classify each hunk as already present, superseded, or still required.
- [ ] Confirm no supervision-letter, intelligent-inspection, permission, or related-record regression is selected.

### Task 2: Add failing subprocess contract tests

**Files:**
- Modify: `tools/test-field-table-status-rules.js`
- Modify: `tools/test-subprocess-supplement.js`
- Modify: `tools/validate-subprocess-contract.js`

**Interfaces:**
- Consumes: residual-rule list from Task 1.
- Produces: assertions for per-type fields, node visibility/editability, required validation, and length limits.

- [ ] Add assertions for the residual schema rules before modifying production sources.
- [ ] Run the focused scripts and verify they fail for the expected missing rules.

### Task 3: Migrate canonical schema and examples

**Files:**
- Modify: `data/forms/subprocesses.json`
- Modify: `data/seed-data.json`
- Modify only if required: `app.js`
- Generate: `data/form-schema.json`
- Generate: `data/prototype-data.runtime.js`

**Interfaces:**
- Consumes: tests from Task 2.
- Produces: field-table-driven forms and correct status examples without replacing newer modules.

- [ ] Apply the smallest schema changes needed to satisfy each failing assertion.
- [ ] Add or correct example records for every affected subprocess status.
- [ ] Regenerate derived schema/runtime files using repository scripts.
- [ ] Run the focused tests until green.

### Task 4: Regression and PR update

**Files:**
- Modify only when required by a demonstrated regression: `styles.css`
- Update: this PR branch and PR #45 metadata.

**Interfaces:**
- Consumes: green focused tests and generated artifacts.
- Produces: updated PR #45 based on current `main`.

- [ ] Run `npm run check:syntax`, `npm run test:data`, `npm run check:generated`, and the relevant UI tests.
- [ ] Compare the branch against `main` and verify no superseded modules are reintroduced.
- [ ] Commit, push the rewritten branch, and update PR #45 with verification and residual-risk notes.
