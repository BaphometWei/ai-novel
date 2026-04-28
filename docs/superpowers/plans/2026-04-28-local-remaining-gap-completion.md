# Local Remaining Gap Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining local-only gaps after the strict hardening and follow-up merges, without external credentials, CI secrets, OS keychain selection, release signing, or representative manuscript data.

**Architecture:** Keep fake/local providers single-step by default, add an explicit pre-send inspection path that prepares context and budget information before execution, and use the persistent local API for browser coverage. Keep mock E2E only where it verifies UI request serialization or display formatting that is not naturally covered by local API fixtures.

**Tech Stack:** TypeScript, Fastify, React, Vitest, Playwright, SQLite repositories, filesystem artifacts, npm workspaces.

---

## Acceptance Matrix

1. Documentation status is accepted only when current completion docs name the latest pushed `main` commit and no stale unchecked local completion steps remain.
2. Pre-send inspection is accepted only when writing runs expose `prepare`, `execute`, and `cancel` routes, build server-side context during prepare, estimate provider budget without calling external services, and reject direct single-step external-provider execution.
3. UI confirmation is accepted only when the manuscript editor can prepare an inspectable send, render provider/model, context, citations, exclusions, warnings, budget estimate, and execute or cancel without creating output on cancel.
4. E2E cleanup is accepted only when redundant route-mock tests already covered by real local API specs are removed or converted, while display-only/request-serialization mocks remain intentionally.
5. Verification is accepted only when focused API/UI/E2E checks pass, `npm run verify:local` passes, git state is inspected, and `main` is committed and pushed normally.

---

## Task 1: Documentation State Cleanup

**Files:**
- Modify: `docs/superpowers/plans/2026-04-28-agent-system-completion.md`
- Modify: `docs/operations/external-blockers.md`

- [x] **Step 1: Replace stale completion status**

Update the completion checklist and push transport note to reflect latest verified local implementation commit `1b9ffb4 feat: finish local remaining gaps`.

- [x] **Step 2: Verify no stale local completion markers remain**

Run:

```powershell
rg -n "1727d5f|\\[ \\].*Step [2-7]|push transport|origin/main" docs/superpowers/plans/2026-04-28-agent-system-completion.md docs/operations/external-blockers.md
```

Expected: any `1727d5f` references are historical only or gone; Task 10 no longer has stale unchecked steps.

---

## Task 2: Pre-Send Writing Inspection API

**Files:**
- Modify: `packages/workflow/src/writing-workflow.ts`
- Modify: `apps/api/src/services/provider-runtime.ts`
- Modify: `apps/api/src/services/writing-run.service.ts`
- Modify: `apps/api/src/routes/writing-runs.routes.ts`
- Modify: `apps/api/src/test/writing-runs.persistence.test.ts`
- Modify: `apps/api/src/test/writing-runs.routes.test.ts`

- [x] **Step 1: Write failing API tests**

Add tests that prove:
- `POST /projects/:projectId/writing-runs/prepare` returns a prepared handle, context pack, provider/model, warnings, and budget estimate without calling the provider.
- `POST /projects/:projectId/writing-runs/:preparedRunId/execute` executes the prepared context and records the prepared handle.
- `POST /projects/:projectId/writing-runs/:preparedRunId/cancel` cancels without output artifacts.
- Direct single-step external-provider writing returns a pre-send inspection error and does not call `fetch`.

Run:

```powershell
npx vitest run apps/api/src/test/writing-runs.persistence.test.ts apps/api/src/test/writing-runs.routes.test.ts
```

Expected before implementation: the new route and service tests fail.

- [x] **Step 2: Export prompt preview helper**

Export the writing draft prompt builder from `packages/workflow/src/writing-workflow.ts` so prepare and execute estimate the same context prompt shape used by the writing workflow.

- [x] **Step 3: Add provider preview inspection**

Add `ProviderRuntime.inspectSend()` that reports provider, model, external/local classification, budget estimate, and blocking reasons without making a network call or exposing secrets.

- [x] **Step 4: Add persistent prepare/execute/cancel service methods**

Persist prepared sends as durable jobs with workflow type `writing.prepare`, save the prepared context pack, execute only fresh confirmed handles, and reject stale, cancelled, cross-project, missing, or blocked handles.

- [x] **Step 5: Add routes and status mapping**

Add the three writing-run subroutes and map disabled external model to 403, missing handle to 404, stale/cancelled/blocked/pre-send-required to 409, and missing dependencies to 503.

- [x] **Step 6: Verify focused API tests**

Run the same Vitest command from Step 1.

---

## Task 3: Manuscript Editor Confirmation UI

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/ManuscriptEditor.tsx`
- Modify: `apps/web/src/test/writing-workbench.test.tsx`
- Modify: `tests/e2e/real-local-workflow.spec.ts`

- [x] **Step 1: Write failing UI tests**

Add a component test that prepares a send, renders inspection details, executes the prepared send, and clears the prepared state on cancel.

Run:

```powershell
npx vitest run apps/web/src/test/writing-workbench.test.tsx
```

Expected before implementation: the new controls and client methods are missing.

- [x] **Step 2: Extend the API client**

Add `prepareWritingRun`, `executePreparedWritingRun`, and `cancelPreparedWritingRun` methods plus response adaptation for pre-send inspection payloads.

- [x] **Step 3: Add confirmation controls**

Add explicit `Inspect before send`, `Confirm send`, and `Cancel prepared send` controls. Keep `Generate draft` as the existing fake/local single-step path.

- [x] **Step 4: Add real local browser coverage**

Add a no-route-mock Playwright path that prepares and executes a writing run against the local API.

- [x] **Step 5: Verify focused UI and E2E**

Run:

```powershell
npx vitest run apps/web/src/test/writing-workbench.test.tsx
npx playwright test tests/e2e/real-local-workflow.spec.ts
```

---

## Task 4: E2E Mock Cleanup

**Files:**
- Delete: `tests/e2e/writing-flow.spec.ts`
- Modify: `tests/e2e/workspace.spec.ts`
- Modify: `docs/superpowers/plans/2026-04-28-local-remaining-gap-completion.md`

- [x] **Step 1: Remove redundant mock writing flow**

Delete `tests/e2e/writing-flow.spec.ts` because `tests/e2e/real-local-workflow.spec.ts` covers the real local writing flow.

- [x] **Step 2: Remove route-mock tests covered by real local API**

Remove workspace mock tests for global search/approval queue and provider defaults that are already covered by `real-local-v3-panels.spec.ts`.

- [x] **Step 3: Keep intentional display-only mocks**

Keep mocks for shell layout, responsive overflow, request serialization, agent-room formatting, observability formatting, retrieval pass/fail evidence, and review-learning recurrence/regression display.

- [x] **Step 4: Verify remaining E2E**

Run:

```powershell
rg -n "page\\.route|route\\.fulfill" tests/e2e
npx playwright test tests/e2e
```

Expected: remaining route mocks are in intentional display-only/request-serialization tests, and all Playwright tests pass.

---

## Task 5: Final Verification, Commit, Push

**Files:**
- All touched files.

- [x] **Step 1: Run focused checks**

Run all focused commands listed in Tasks 2-4.

- [x] **Step 2: Run full local gate**

Run:

```powershell
npm run verify:local
```

- [x] **Step 3: Inspect git state**

Run:

```powershell
git status --short --branch
git diff --stat
```

- [x] **Step 4: Commit and push**

Run:

```powershell
git add docs packages apps tests scripts package.json package-lock.json
git commit -m "feat: finish local remaining gaps"
git push origin main
```

Expected: normal non-force push succeeds.

Observed: normal non-force push succeeded for `1b9ffb4 feat: finish local remaining gaps`; a docs-only status follow-up records this completed push.
