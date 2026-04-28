# Strict Local Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the local-only system-design gaps without live providers, OS keychain decisions, CI secrets, release signing, or external representative manuscript data.

**Architecture:** Keep the existing local-first stack: Fastify API, React/Vite UI, SQLite repositories, filesystem artifacts, fake provider, Vitest, and Playwright. Add explicit contracts, local rehearsal tests, real local API browser paths, and operational docs so later external decisions can swap implementations without changing the architecture.

**Tech Stack:** TypeScript, Fastify, React, Vitest, Playwright, Drizzle SQLite, npm workspaces.

---

## Strict Acceptance Matrix

1. Secret storage boundary is accepted only when there is a `ProviderSecretStore` interface, env-only implementation, explicit unsupported-ref errors, tests, and no DB persistence of raw provider keys.
2. Project no-external-model is accepted only when domain/db/api/ui expose the policy and writing/orchestration/provider runtime fail closed for external providers while fake local runs still work.
3. Real API panel empty/insufficient states are accepted only when API-backed empty projects do not silently render demo findings or fake policies.
4. Local production-like rehearsal is accepted only when a command creates a temp local runtime, runs migrations/runtime flows, exercises backup/verify/restore, and cleans up without external services.
5. Quality thresholds are accepted only when schema/defaults/API/client/UI display exist and retrieval regression can report thresholds, triage hints, included/excluded IDs, and failure reasons.
6. Recovery docs are accepted only when DB, WAL, artifacts, backup, restore, rollback, migration failure, and secret-safety procedures are documented.
7. Deep recovery rehearsal is accepted only when temp SQLite plus artifact directories prove backup -> verify -> restore-to-new-project -> restore record -> cross-project isolation.
8. V3 E2E real API migration is accepted only when an additional no-`page.route` Playwright test covers the listed panels through the local API.
9. Synthetic longform quality framework is accepted only when repo-owned fixtures drive thresholded retrieval reports with included/excluded/failure data.
10. Documentation status is accepted only when stale unchecked commit/push or incomplete-local claims are corrected to match current verified state.

---

## Task 1: Document The Strict Plan And Status

**Files:**
- Create: `docs/superpowers/plans/2026-04-28-strict-local-gap-closure.md`
- Modify: `docs/superpowers/plans/2026-04-28-local-only-hardening-completion.md`
- Modify: `docs/superpowers/plans/2026-04-28-agent-system-completion.md`

- [x] **Step 1: Write this strict acceptance matrix**

This file is the operator-facing implementation plan for the remaining local-only gaps.

- [x] **Step 2: Mark old local-hardening plan as superseded**

Add a short note at the top of `2026-04-28-local-only-hardening-completion.md`:

```markdown
> Superseded by `2026-04-28-strict-local-gap-closure.md` for strict 10-point closure tracking. This earlier plan recorded partial local-hardening work and must not be read as full completion of the 10 gaps.
```

- [x] **Step 3: Correct stale completion checklist**

In `2026-04-28-agent-system-completion.md`, change only stale local status lines that contradict current git evidence. Do not claim this strict 10-point closure is complete until this plan is verified.

- [x] **Step 4: Verify docs references**

Run:

```powershell
rg -n "Superseded|strict 10-point|commit|push|verified" docs/superpowers/plans
```

Expected: old partial-plan wording points at this strict plan and no stale unchecked push status remains.

---

## Task 2: Secret Store And External Provider Fail-Closed Guard

**Files:**
- Modify: `packages/llm-gateway/src/secret-store.ts`
- Modify: `packages/llm-gateway/src/provider-config.ts`
- Modify: `packages/llm-gateway/src/provider-config.test.ts`
- Modify: `packages/db/src/test/settings.repository.test.ts`
- Modify: `apps/api/src/services/provider-runtime.ts`
- Modify: `apps/api/src/test/runtime.test.ts`

- [x] **Step 1: Add failing tests**

Add tests for env secret resolution, missing secret errors, unsupported `keychain:` errors, no raw `apiKey` persistence in settings metadata, and provider-runtime fail-closed behavior when `allowExternalModel: false` and a non-fake provider is configured.

Run:

```powershell
npx vitest run packages/llm-gateway/src/provider-config.test.ts packages/db/src/test/settings.repository.test.ts apps/api/src/test/runtime.test.ts
```

Expected before implementation: runtime fail-closed test fails if the guard only knows the happy path.

- [x] **Step 2: Implement only the env secret backend**

`ProviderSecretStore.resolve(secretRef)` must return a string or throw an explicit unsupported-reference error. Missing env values are reported by `resolveProviderConfig` as `Missing provider secret: <ref>`.

- [x] **Step 3: Fail closed for external providers**

In `provider-runtime.ts`, classify `undefined` and `fake` as local, classify `openai` as external, and throw `External model use is disabled for this project` before resolving secrets or constructing real providers when `allowExternalModel` is false.

- [x] **Step 4: Verify focused tests**

Run the same Vitest command from Step 1. Expected: all targeted tests pass.

---

## Task 3: Quality Threshold Configuration And Synthetic Reports

**Files:**
- Create: `packages/evaluation/src/quality-thresholds.ts`
- Modify: `packages/evaluation/src/index.ts`
- Modify: `packages/evaluation/src/retrieval-regression.ts`
- Modify: `packages/evaluation/src/retrieval-regression.test.ts`
- Modify: `packages/evaluation/src/fixtures/longform-corpus.ts`
- Modify: `apps/api/src/routes/retrieval.routes.ts`
- Modify: `apps/api/src/test/retrieval.routes.test.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/RetrievalEvaluationPanel.tsx`
- Modify: `apps/web/src/test/RetrievalEvaluationPanel.test.tsx`

- [x] **Step 1: Add failing threshold tests**

Tests must expect default threshold config, request-level threshold overrides, UI display of threshold source, and regression output with `thresholds`, `includedIds`, `excludedIds`, `triageHints`, and `failures`.

Run:

```powershell
npx vitest run packages/evaluation/src/retrieval-regression.test.ts apps/api/src/test/retrieval.routes.test.ts apps/web/src/test/RetrievalEvaluationPanel.test.tsx
```

- [x] **Step 2: Implement config schema**

Create `defaultQualityThresholdConfig` with synthetic local defaults:

```ts
export const defaultQualityThresholdConfig = {
  source: 'synthetic-local-defaults',
  retrieval: {
    requiredCoverage: 1,
    forbiddenLeakage: 0
  }
} as const;
```

Add `parseQualityThresholdConfig` to normalize optional overrides and reject invalid numeric ranges.

- [x] **Step 3: Wire API/client/UI**

Expose `GET /retrieval/quality-thresholds`, allow optional `thresholds` on regression requests, and render the returned config in `RetrievalEvaluationPanel`.

- [x] **Step 4: Verify focused tests**

Run the Step 1 command. Expected: all targeted tests pass.

---

## Task 4: Real Empty States For API-Backed Panels

**Files:**
- Modify: `apps/web/src/components/ReviewCenter.tsx`
- Modify: `apps/web/src/test/review-center.test.tsx`
- Modify: `apps/web/src/components/ScheduledBackupPanel.tsx`
- Modify: `apps/web/src/test/ScheduledBackupPanel.test.tsx`
- Modify: `apps/web/src/components/ObservabilityDashboard.tsx`
- Modify: `apps/web/src/test/observability-dashboard.test.tsx`

- [x] **Step 1: Add failing UI tests**

Tests must assert API-backed empty review reports show `No review findings yet`, empty scheduled backup data shows `No scheduled backup policies` and `No due backup intents`, and empty observability shows `Insufficient observation data`.

Run:

```powershell
npx vitest run apps/web/src/test/review-center.test.tsx apps/web/src/test/ScheduledBackupPanel.test.tsx apps/web/src/test/observability-dashboard.test.tsx
```

- [x] **Step 2: Remove API-backed demo fallback**

Keep demo data only for no-client demo mode. When a real client is present and returns empty arrays or zero observations, render explicit empty states.

- [x] **Step 3: Verify focused tests**

Run the Step 1 command. Expected: all targeted tests pass.

---

## Task 5: Deep Recovery Rehearsal And Production-Like Script

**Files:**
- Modify: `apps/api/src/test/backup.routes.test.ts`
- Create: `apps/api/src/test/local-production-rehearsal.test.ts`
- Modify: `scripts/verify-local-production.mjs`
- Modify: `package.json`
- Modify: `docs/operations/recovery.md`

- [x] **Step 1: Add failing recovery rehearsal test**

Use a temp directory with a real SQLite file. Create source and untouched projects, write source chapters/artifacts, create backup, verify backup, restore to a new project, inspect restore records, assert restored artifact body can be read, and assert untouched project data is unchanged.

Run:

```powershell
npx vitest run apps/api/src/test/backup.routes.test.ts
```

- [x] **Step 2: Add local production-like rehearsal command**

Add `npm run rehearse:local-production` running `apps/api/src/test/local-production-rehearsal.test.ts`. The test creates a temp runtime, exercises API flow, backup/verify/restore, and cleanup.

- [x] **Step 3: Include rehearsal in verify-local**

Update `scripts/verify-local-production.mjs` so it runs the rehearsal before Playwright.

- [x] **Step 4: Document local recovery**

Update `docs/operations/recovery.md` with DB/WAL, artifact copy, backup verify, restore rehearsal, migration failure recovery, rollback record, and script commands.

- [x] **Step 5: Verify focused tests**

Run:

```powershell
npx vitest run apps/api/src/test/backup.routes.test.ts apps/api/src/test/local-production-rehearsal.test.ts
node scripts/verify-local-production.mjs
```

Expected: all commands pass locally without external providers.

---

## Task 6: Real Local V3 API E2E Coverage

**Files:**
- Modify: `tests/e2e/real-local-v3-panels.spec.ts`
- Possibly modify: `tests/e2e/real-local-workflow.spec.ts`

- [x] **Step 1: Add no-mock E2E coverage**

In a test file with no `page.route`, use the running local API to cover these panels: version history, retrieval evaluation, narrative intelligence, governance audit, scheduled backups, branch/retcon, review learning, and import/export.

- [x] **Step 2: Keep setup deterministic**

Use API requests and fake provider flows only. Do not call external services or paid providers.

- [x] **Step 3: Verify E2E**

Run:

```powershell
npx playwright test tests/e2e/real-local-v3-panels.spec.ts
```

Expected: the real local V3 panel test passes and contains no `page.route`.

---

## Task 7: Final Verification And Commit

**Files:**
- All files touched by Tasks 1-6.

- [x] **Step 1: Run focused verification**

Run all focused commands named in Tasks 2-6 and read their output.

- [x] **Step 2: Run full local verification**

Run:

```powershell
npm run verify:local
```

Expected: tests, build, DB check, production-like rehearsal, and Playwright pass.

- [x] **Step 3: Inspect diff**

Run:

```powershell
git status --short --branch
git diff --stat
```

Expected: only strict local-gap closure files are changed.

- [x] **Step 4: Commit**

Run:

```powershell
git add docs packages apps tests scripts package.json package-lock.json
git commit -m "feat: close strict local hardening gaps"
```

Expected: commit succeeds on `codex/local-hardening-completion`.

## Completion Evidence

- Focused Vitest: provider secret/runtime/settings, retrieval thresholds/API/UI, empty states, backup recovery, and local production rehearsal all passed.
- Focused Playwright: `tests/e2e/real-local-v3-panels.spec.ts` passed with no `page.route` in the real-local spec.
- Full local gate: `npm run verify:local` passed on 2026-04-28 with 157 Vitest files / 501 tests, build, DB check, `npm run rehearse:local-production`, and 20 Playwright tests.
