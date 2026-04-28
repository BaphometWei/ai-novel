# Local-Only Hardening Completion Implementation Plan

> Superseded by `2026-04-28-strict-local-gap-closure.md` for strict 10-point closure tracking. This earlier plan recorded partial local-hardening work and must not be read as full completion of the 10 gaps.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the production-hardening gaps that do not depend on live provider credentials, CI secrets, code signing, release channels, OS keychain selection, or product-owner quality thresholds.

**Architecture:** Keep the current local-first React/Vite + Fastify + SQLite + local artifact architecture. Add stronger local recovery documentation, deterministic quality-evaluation structure, provider-secret abstraction, project-level external-model controls, and more real local API acceptance coverage while preserving fake-provider verification.

**Tech Stack:** TypeScript, Fastify, React, Vitest, Playwright, Drizzle SQLite, npm workspaces.

---

## Non-External Scope

In scope:

- Local recovery and operations documentation.
- Deterministic restore/recovery tests and production-like local checks.
- Synthetic long-form retrieval quality fixtures and richer failure triage.
- Provider secret abstraction using environment variables as the only implemented backend.
- Project-level no-external-model policy that blocks real provider use locally.
- Additional real local API browser coverage where it can be done deterministically.
- Documentation status cleanup for already-completed commit/push state.

Out of scope:

- Real provider smoke tests.
- GitHub secret configuration.
- Code signing, installer publishing, or auto-update rollout.
- OS keychain implementation choice.
- Real representative manuscript corpus or final product-owner thresholds.

---

## File Structure Map

- Create: `docs/operations/recovery.md` - local recovery runbook for DB, artifacts, backups, restores, and migrations.
- Modify: `docs/operations/external-blockers.md` - keep external blockers, remove stale push-blocker wording once current git state proves synced.
- Modify: `docs/superpowers/plans/2026-04-28-agent-system-completion.md` - mark final commit/push checklist as current if git state confirms it.
- Create: `packages/llm-gateway/src/secret-store.ts` - provider-secret resolver abstraction with env-only implementation.
- Modify: `packages/llm-gateway/src/provider-config.ts` - resolve `env:` secrets through the abstraction.
- Modify: `packages/llm-gateway/src/provider-config.test.ts` - prove env resolution and unsupported secret refs stay explicit.
- Modify: `packages/llm-gateway/src/index.ts` - export the secret-store boundary.
- Modify: `apps/api/src/services/provider-runtime.ts` - use the env secret store and project/provider controls without storing raw keys.
- Modify: `packages/domain/src/project/project.ts` - add external model policy to projects.
- Modify: `packages/db/src/schema.ts`, `packages/db/src/migrate.ts`, `packages/db/src/repositories/project.repository.ts`, `packages/db/src/test/project.repository.test.ts` - persist project external model policy.
- Modify: `apps/api/src/services/project.service.ts`, `apps/api/src/routes/projects.routes.ts`, `apps/api/src/test/project.repository or routes tests` - expose policy updates.
- Modify: `apps/api/src/services/writing-run.service.ts`, `apps/api/src/services/agent-orchestration.service.ts`, and focused tests - block external-provider runs when the project policy forbids them while allowing fake deterministic local runs.
- Create: `packages/evaluation/src/fixtures/longform-corpus.ts` - synthetic corpus with must-include and forbidden source records.
- Modify: `packages/evaluation/src/retrieval-regression.ts`, `packages/evaluation/src/retrieval-regression.test.ts` - add thresholds, includedIds, excludedIds, triageHints.
- Modify: `apps/api/src/routes/retrieval.routes.ts`, `apps/api/src/test/retrieval.routes.test.ts` - expose richer retrieval regression output.
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/components/RetrievalEvaluationPanel.tsx`, `apps/web/src/test/RetrievalEvaluationPanel.test.tsx` - render failure triage and thresholds.
- Create or modify: `tests/e2e/real-local-workflow.spec.ts` or `tests/e2e/real-local-v3-panels.spec.ts` - add real API coverage for at least one V3 panel path without `page.route`.

---

## Task 1: Recovery Runbook And Status Cleanup

**Files:**
- Create: `docs/operations/recovery.md`
- Modify: `docs/operations/external-blockers.md`
- Modify: `docs/superpowers/plans/2026-04-28-agent-system-completion.md`

- [ ] **Step 1: Verify current git state**

Run:

```powershell
git status --short --branch
git log --oneline --decorate -n 3
```

Expected: current branch is synced with its upstream, and the latest commit contains the completed hardening batch.

- [ ] **Step 2: Write local recovery runbook**

Create `docs/operations/recovery.md` with:

- prerequisites and safety notes;
- `npm run db:check`, `npm run dev:api`, `npm run dev:web`, `npm run test:e2e`, and `npm run verify:local`;
- SQLite/WAL backup notes;
- artifact directory copy rules;
- backup verification and restore rehearsal steps;
- rollback metadata expectations;
- secret/log safety notes.

- [ ] **Step 3: Clean stale completion status**

Update `docs/superpowers/plans/2026-04-28-agent-system-completion.md` only where the final checklist is stale. If `git status --short --branch` shows the branch is synced, mark commit and push complete.

Update `docs/operations/external-blockers.md` so the Git Push Transport Note records that the later sync closed the note, while keeping historical context.

- [ ] **Step 4: Verify docs**

Run:

```powershell
rg -n "recovery|Git Push Transport|All changes are committed|git push origin main" docs/operations docs/superpowers/plans/2026-04-28-agent-system-completion.md
```

Expected: recovery docs exist, external blockers remain external, stale push checklist is no longer misleading.

---

## Task 2: Provider Secret Store Boundary

**Files:**
- Create: `packages/llm-gateway/src/secret-store.ts`
- Modify: `packages/llm-gateway/src/provider-config.ts`
- Modify: `packages/llm-gateway/src/provider-config.test.ts`
- Modify: `packages/llm-gateway/src/index.ts`
- Modify: `apps/api/src/services/provider-runtime.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving:

- `createEnvSecretStore({ OPENAI_API_KEY: "sk-local" }).resolve("env:OPENAI_API_KEY")` returns the secret.
- missing env secrets throw `Missing provider secret: env:OPENAI_API_KEY`.
- unsupported refs such as `keychain:openai` throw `Unsupported provider secret reference: keychain:openai`.
- `resolveProviderConfig` accepts an injected secret store.

Run:

```powershell
npx vitest run packages/llm-gateway/src/provider-config.test.ts
```

Expected: tests fail because `secret-store.ts` does not exist and `resolveProviderConfig` does not accept a secret store.

- [ ] **Step 2: Implement env-only secret store**

Create a small `ProviderSecretStore` interface and `createEnvSecretStore(env)` implementation. Do not store raw API keys in DB or logs.

- [ ] **Step 3: Wire provider config**

Change `resolveProviderConfig` to call the secret store. Default behavior remains env-only through `process.env` or passed `env`.

- [ ] **Step 4: Wire API provider runtime**

Use `createEnvSecretStore(options.env ?? process.env)` in `apps/api/src/services/provider-runtime.ts`. Keep the fake provider fallback for unconfigured local runs.

- [ ] **Step 5: Verify**

Run:

```powershell
npx vitest run packages/llm-gateway/src/provider-config.test.ts apps/api/src/test/runtime.test.ts apps/api/src/test/settings.routes.test.ts
```

Expected: targeted tests pass.

---

## Task 3: Project No-External-Model Policy

**Files:**
- Modify: `packages/domain/src/project/project.ts`
- Modify: `packages/domain/src/project/project.test.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/migrate.ts`
- Modify: `packages/db/src/repositories/project.repository.ts`
- Modify: `packages/db/src/test/project.repository.test.ts`
- Modify: `apps/api/src/services/project.service.ts`
- Modify: `apps/api/src/routes/projects.routes.ts`
- Modify: `apps/api/src/test/app.test.ts` or create `apps/api/src/test/projects.routes.test.ts`
- Modify: `apps/api/src/services/writing-run.service.ts`
- Modify: `apps/api/src/test/writing-runs.persistence.test.ts`

- [ ] **Step 1: Write failing domain and repository tests**

Assert new projects default to `externalModelPolicy: "Allowed"` and can persist `externalModelPolicy: "Disabled"`.

Run:

```powershell
npx vitest run packages/domain/src/project/project.test.ts packages/db/src/test/project.repository.test.ts
```

Expected: tests fail until the property and DB column exist.

- [ ] **Step 2: Add domain and persistence support**

Add `externalModelPolicy: "Allowed" | "Disabled"` to `Project`. Add `external_model_policy TEXT NOT NULL DEFAULT 'Allowed'` with migration backfill.

- [ ] **Step 3: Add API update route**

Add `PATCH /projects/:id/external-model-policy` accepting `{ externalModelPolicy: "Allowed" | "Disabled" }`. Return 404 when the project does not exist.

- [ ] **Step 4: Enforce writing-run guard**

When a project policy is `Disabled`, writing/orchestration must refuse real external-provider runs. Fake local providers remain allowed for deterministic local verification. The error must be explicit: `External model use is disabled for this project`.

- [ ] **Step 5: Verify**

Run:

```powershell
npx vitest run packages/domain/src/project/project.test.ts packages/db/src/test/project.repository.test.ts apps/api/src/test/projects.routes.test.ts apps/api/src/test/writing-runs.persistence.test.ts
```

Expected: targeted tests pass.

---

## Task 4: Retrieval Quality Triage

**Files:**
- Create: `packages/evaluation/src/fixtures/longform-corpus.ts`
- Modify: `packages/evaluation/src/retrieval-regression.ts`
- Modify: `packages/evaluation/src/retrieval-regression.test.ts`
- Modify: `apps/api/src/routes/retrieval.routes.ts`
- Modify: `apps/api/src/test/retrieval.routes.test.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/RetrievalEvaluationPanel.tsx`
- Modify: `apps/web/src/test/RetrievalEvaluationPanel.test.tsx`

- [ ] **Step 1: Write failing retrieval tests**

Add tests expecting regression results to include:

- `thresholds: { requiredCoverage: number; forbiddenLeakage: number }`;
- `includedIds` and `excludedIds`;
- `triageHints` for missing must-include items and included forbidden items;
- synthetic corpus cases with canon facts, forbidden source samples, promises, and secrets.

Run:

```powershell
npx vitest run packages/evaluation/src/retrieval-regression.test.ts apps/api/src/test/retrieval.routes.test.ts apps/web/src/test/RetrievalEvaluationPanel.test.tsx
```

Expected: tests fail until result contracts and UI adapters are updated.

- [ ] **Step 2: Implement evaluation contract**

Keep the existing pass/fail behavior and add the richer fields without requiring real corpus data.

- [ ] **Step 3: Expose through API and UI**

Return the richer fields from retrieval routes. Render thresholds and triage hints in the retrieval evaluation panel.

- [ ] **Step 4: Verify**

Run:

```powershell
npx vitest run packages/evaluation/src/retrieval-regression.test.ts apps/api/src/test/retrieval.routes.test.ts apps/web/src/test/RetrievalEvaluationPanel.test.tsx
```

Expected: targeted tests pass.

---

## Task 5: Additional Real Local API Acceptance

**Files:**
- Modify or create: `tests/e2e/real-local-v3-panels.spec.ts`
- Possibly modify: `playwright.config.ts` only if existing setup cannot serve the route.

- [ ] **Step 1: Add a no-route Playwright test**

Add a real local API test that does not call `page.route` and covers one V3 panel beyond the writing flow. Preferred path: run project retrieval regression through the UI or API-backed backup restore panel against the running local API.

- [ ] **Step 2: Keep the test deterministic**

Use the existing fake provider and seeded local API. Do not call paid providers or rely on external data.

- [ ] **Step 3: Verify**

Run:

```powershell
npx playwright test tests/e2e/real-local-workflow.spec.ts tests/e2e/real-local-v3-panels.spec.ts
```

Expected: real local API acceptance tests pass without `page.route`.

---

## Task 6: Final Verification And Commit

**Files:**
- All files changed by Tasks 1-5.

- [ ] **Step 1: Run focused checks**

Run focused Vitest and Playwright commands from each completed task.

- [ ] **Step 2: Run full local verification**

Run:

```powershell
npm run verify:local
```

Expected: unit tests, build, DB check, and Playwright all pass.

- [ ] **Step 3: Inspect git state**

Run:

```powershell
git status --short --branch
git diff --stat
```

Expected: only intentional local-hardening files changed.

- [ ] **Step 4: Commit**

Run:

```powershell
git add docs packages apps tests
git commit -m "feat: complete local-only hardening gaps"
```

Expected: commit succeeds on `codex/local-hardening-completion`.

---

## Self-Review

- This plan excludes all live credentials, CI secret setup, code signing, release channels, OS keychain implementation, and real manuscript quality thresholds.
- Each task has bounded ownership and deterministic verification.
- The only new production behavior is local policy enforcement and richer local quality triage.
- Fake provider workflows remain supported so `npm run verify:local` stays external-free.
