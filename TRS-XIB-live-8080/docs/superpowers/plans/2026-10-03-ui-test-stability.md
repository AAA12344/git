# UI Test Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove race conditions from the three UI tests that block PR #5 from passing the complete verification suite.

**Architecture:** Stabilize browser tests with condition-based waits tied to observable application state and deterministic DOM clicks for custom controls. Correct notification-list navigation so top-level navigation cannot retain a stale detail selection.

**Tech Stack:** Node.js, Playwright, PowerShell, npm scripts.

**Spec:** User-approved risk-remediation request in the current conversation.

## Global Constraints

- Do not increase timeouts as the primary fix.
- Do not bypass `npm run verify`.
- Preserve real browser interactions and assertions.
- Require five consecutive passes for each historically flaky test and two complete verification passes.

---

### Task 1: Ticket Demo Readiness

**Files:**
- Modify: `tools/test-created-ticket-work-pool.js`
- Test: `tools/test-created-ticket-work-pool.js`

**Interfaces:**
- Consumes: ticket Demo fill action and customer-name field.
- Produces: deterministic readiness wait before changing acceptance channel.

- [x] Reproduce the hidden-option timeout in the complete suite.
- [x] Add a condition wait for customer name `陈晓敏` after Demo fill.
- [x] Run `npm run test:created-ticket-work-pool` and confirm success.

### Task 2: Home Role Switching

**Files:**
- Modify: `tools/test-home-ui.js`
- Test: `tools/test-home-ui.js`

**Interfaces:**
- Consumes: `#role-cascade-trigger`, `data-role-profile`, home module footer.
- Produces: deterministic role selection that waits for menu visibility and expected task count.

- [x] Replace actionability-sensitive role clicks with DOM clicks plus explicit visible/state waits.
- [x] Reset stale notification detail state when top-level navigation requests the list.
- [x] Run `npm run test:home-ui` five consecutive times.

### Task 3: Region Cascader Interaction

**Files:**
- Modify: `tools/test-region-linkage.js`
- Test: `tools/test-region-linkage.js`

**Interfaces:**
- Consumes: country selector and residence cascader DOM state.
- Produces: deterministic open/select/wait sequence scoped to the visible popover.

- [x] Add explicit control-ready and final-value waits around a single synchronous cascader selection sequence.
- [x] Preserve page cleanup through the existing browser-owned `finally` block.
- [x] Run `npm run test:region-linkage` five consecutive times.

### Task 4: Direct File Pagination Synchronization

**Files:**
- Modify: `tools/test-direct-file-open.js`
- Test: `tools/test-direct-file-open.js`

- [x] Reproduce the delayed page-one rerender race.
- [x] Wait for the active pagination control before selecting a user.
- [x] Run `npm run test:file-open` four consecutive times.

### Task 5: Full Gate

**Files:**
- Modify: none unless verification identifies a reproducible root cause.

**Interfaces:**
- Consumes: all repository verification scripts.
- Produces: merge evidence for PR #5.

- [x] Run `npm run check:generated`.
- [x] Run complete verification until all identified races are repaired, then confirm a fresh `npm run verify` pass.
- [ ] Commit and push test-stability changes.
- [ ] Confirm PR checks on the latest head before merge.
