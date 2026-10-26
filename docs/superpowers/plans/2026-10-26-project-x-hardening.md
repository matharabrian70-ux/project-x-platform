# Project X Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the currently deployed Project X demo into a testable, persistent, observable five-product operating-system application without breaking the live service.

**Architecture:** Keep the existing single Node/Express service and glass UI. Use the dedicated Render Postgres database through `DATABASE_URL`, keep product domain calculations in a small tested module, and instrument the browser/server workflow with PostHog. Use GitHub Actions as the reproducible test gate before production deployment.

**Tech Stack:** Node.js, Express 5, PostgreSQL via `pg`, Node's built-in test runner, GitHub Actions, PostHog.

**Spec:** Existing Project X execution plan plus the current repository implementation and deployed Render configuration.

## Global Constraints

- International product positioning; the five OS products remain distinct but share one platform.
- No destructive changes to existing customer/project data without an explicit migration requirement.
- No production claim until tests and live health checks pass.
- Use the existing dedicated Project X Render Postgres database rather than creating another database.
- Keep the current glass-style dashboard and five-product workflow surface.
- Keep secrets/configuration in environment variables; never hard-code credentials.

## Review Focus

- Missing domain module referenced by the existing test suite → test must fail first, then pass after the module is added.
- Database unavailable or unconfigured → health endpoint must clearly distinguish persistent DB mode from demo-memory mode.
- Product records must not leak across the five products → API tests must enforce product scoping.
- Invalid workflow transitions must be rejected → domain transition test must remain green.
- Analytics must not block product operation → PostHog failures must be non-fatal.

### Task 1: Establish the CI gate

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `package.json`
- Test: existing `test/domain.test.js`

- [ ] Run the existing domain test through GitHub Actions and confirm the expected RED failure because `src/domain.js` is missing.
- [ ] Add the Node test script and CI workflow.
- [ ] Keep the workflow dependency-light and use the repository's Node runtime.
- [ ] Confirm the workflow reports the expected failing import before implementing the missing module.

### Task 2: Restore the tested domain layer

**Files:**
- Create: `src/domain.js`
- Test: `test/domain.test.js`

- [ ] Implement `weightedPipeline`, `profitAndMargin`, `deliveryProgress`, `netProductRevenue`, `weeklyCompletion`, and `transition` to satisfy the existing tests.
- [ ] Preserve the existing five product state vocabularies.
- [ ] Run the full Node test suite in CI and require PASS.

### Task 3: Make the server use the tested domain layer

**Files:**
- Modify: `projectx-server.js`
- Test: add API/domain smoke coverage where practical.

- [ ] Import the tested domain functions instead of duplicating business calculations in the server.
- [ ] Keep the existing product APIs and glass UI behavior.
- [ ] Make database migration failures visible through `/health` rather than silently presenting persistent mode.
- [ ] Keep memory fallback explicit and safe for demo operation.

### Task 4: Wire persistent Postgres configuration

**Files:**
- Modify: Render service environment configuration, no credential values committed to Git.
- Modify: `projectx-server.js` only if migration/connection handling requires it.

- [ ] Configure `DATABASE_URL` from the dedicated Project X Render Postgres instance.
- [ ] Verify migration creates the product-record table.
- [ ] Verify CRUD against Postgres and confirm the five products are isolated by `product` key.
- [ ] Keep the DB health check fail-closed when a configured database cannot be reached.

### Task 5: Add PostHog observability

**Files:**
- Modify: `projectx-server.js` or a focused browser analytics module.
- Modify: Render environment variables.

- [ ] Configure PostHog host/token through environment variables.
- [ ] Capture product selection, record creation, workflow state change, and page/session entry events.
- [ ] Treat analytics failure as non-fatal.
- [ ] Verify the PostHog project receives the first event before calling the analytics gate complete.

### Task 6: Production verification

**Files:** none unless verification exposes a defect.

- [ ] Confirm latest GitHub CI is green.
- [ ] Confirm latest Render deployment is live and stable.
- [ ] Confirm `/health` reports database-connected mode.
- [ ] Confirm all five product routes/workflows load and persist records.
- [ ] Confirm analytics events are observable.
- [ ] Only then mark the engineering gates complete.
