# AI Novel Production Hardening Overnight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the broad V2/V3 scaffold into a more production-proven local-first system without requiring the sleeping operator for credentials, paid calls, certificates, or product decisions.

**Architecture:** Keep the current React/Vite + Fastify + SQLite + local artifact architecture. Harden the repo by adding real local API acceptance coverage, recovery rehearsals, non-secret provider verification, forced governance gates at workflow boundaries, CI scripts, and explicit blocker docs for external dependencies.

**Tech Stack:** TypeScript, React, Vite, Fastify, Vitest, Playwright, Drizzle/SQLite, npm workspaces, local filesystem artifacts.

---

## Night Authorization

Proceed without asking the operator for repository-local work.

Allowed:

- Add tests, code, scripts, docs, and CI config.
- Use fake provider or injected fetch/provider doubles for deterministic tests.
- Start local dev/test servers.
- Commit and push when verification passes.
- Record blockers for credentials, accounts, certificates, real paid model calls, release channels, OS keychain decisions, and product tradeoffs.

Not allowed:

- Force push.
- Delete real user data.
- Invent real API keys.
- Run paid model calls without a real key and explicit later operator consent.
- Apply destructive dependency fixes such as `npm audit fix --force` unless a targeted, verified safer update is available.

## Workstreams

### Task 1: CI and Local Production Verification Gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Create: `scripts/verify-local-production.mjs`
- Test: run `npm run verify:local`

- [ ] **Step 1: Add root verification scripts**

Add a root script that runs the same proof commands in a fixed order:

```json
{
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "dev:api": "npm --workspace @ai-novel/api run dev",
    "dev:web": "npm --workspace @ai-novel/web run dev",
    "db:check": "npm --workspace @ai-novel/db run db:check",
    "verify:local": "node scripts/verify-local-production.mjs"
  }
}
```

- [ ] **Step 2: Implement the verification runner**

Create `scripts/verify-local-production.mjs`:

```js
import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['test']],
  ['npm', ['run', 'build']],
  ['npm', ['run', 'db:check']],
  ['npm', ['run', 'test:e2e']]
];

for (const [command, args] of commands) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
```

- [ ] **Step 3: Add GitHub CI**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, "codex/**"]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run verify:local
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run verify:local
```

Expected: unit tests, build, db check, and Playwright all pass.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/verify-local-production.mjs .github/workflows/ci.yml
git commit -m "ci: add local production verification gate"
```

### Task 2: Real API Playwright Acceptance Flow

**Files:**
- Modify: `tests/e2e/writing-flow.spec.ts`
- Create: `tests/e2e/real-local-workflow.spec.ts`
- Read: `apps/api/src/runtime.ts`, `apps/web/src/components/ManuscriptEditor.tsx`, `apps/web/src/components/AgentRoom.tsx`

- [ ] **Step 1: Add a no-route acceptance test**

Create a Playwright test that does not call `page.route`, starts against the real local API configured by `playwright.config.ts`, and exercises:

```ts
test('real local API workflow creates a project chapter, generates a deterministic draft, accepts it, and shows run trace', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Project Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'New chapter' }).click();
  await expect(page.getByRole('treeitem', { name: /New working chapter/i })).toBeVisible();
  await page.getByRole('button', { name: 'Generate draft' }).click();
  await expect(page.getByLabel('Scene draft editor')).toContainText('Deterministic writing draft');
  await page.getByRole('button', { name: 'Accept draft into manuscript' }).click();
  await expect(page.getByText(/Accepted as/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agent Room' })).toBeVisible();
});
```

- [ ] **Step 2: If the test fails because seed data is missing, fix the runtime seed**

Seed one default project and one starter chapter in the persistent E2E database only when the database has no projects. Use existing repositories and services in `apps/api/src/runtime.ts`.

- [ ] **Step 3: Verify**

Run:

```bash
npx playwright test tests/e2e/real-local-workflow.spec.ts
```

Expected: the test passes without any `page.route` calls.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/real-local-workflow.spec.ts apps/api/src/runtime.ts
git commit -m "test: add real local workflow acceptance"
```

### Task 3: Remove Product Demo Defaults From Primary Panels

**Files:**
- Modify: `apps/web/src/components/ManuscriptEditor.tsx`
- Modify: `apps/web/src/components/NarrativeIntelligencePanel.tsx`
- Modify: `apps/web/src/components/RetrievalEvaluationPanel.tsx`
- Modify: `apps/web/src/components/GovernanceAuditPanel.tsx`
- Modify: `apps/web/src/components/BranchRetconPanel.tsx`
- Modify: corresponding `apps/web/src/test/*.test.tsx`

- [ ] **Step 1: Replace `project_demo` defaults with selected project props**

Introduce `projectId?: string` props where needed. When no project exists, render an empty state and disable actions instead of silently using `project_demo`.

- [ ] **Step 2: Keep standalone demo mode explicit**

Only render static demo text in components when no API client is passed. When a client is passed, all displayed state should come from the API or from a named empty state.

- [ ] **Step 3: Update tests**

For each affected component, assert both:

```ts
expect(screen.getByText(/No project available/i)).toBeInTheDocument();
expect(client.someApiMethod).not.toHaveBeenCalled();
```

and the populated project path.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run apps/web/src/test
npm run test:e2e
```

Expected: web component tests and e2e pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components apps/web/src/test tests/e2e
git commit -m "fix: remove implicit demo project defaults"
```

### Task 4: Backup, Restore, and Migration Recovery Rehearsal

**Files:**
- Modify: `packages/workflow/src/backup-workflow.ts`
- Modify: `packages/workflow/src/backup-workflow.test.ts`
- Modify: `apps/api/src/routes/backup.routes.ts`
- Modify: `apps/api/src/test/backup.routes.test.ts`
- Modify: `packages/db/src/check.ts`
- Modify: `packages/db/src/test/check.test.ts`
- Create: `docs/operations/recovery.md`

- [ ] **Step 1: Add restore rehearsal test**

Add a test that creates a backup payload with project metadata and artifact hashes, verifies it, restores to a new project id, and records a restore result with checksum status.

- [ ] **Step 2: Add backup-before-migration check**

Extend `db:check` so it records migration history and verifies schema health without writing raw secrets or user manuscript text to logs.

- [ ] **Step 3: Document operator recovery**

Create `docs/operations/recovery.md` with exact local recovery commands:

```bash
npm run db:check
npm run dev:api
npm run dev:web
npm run test:e2e
```

Include backup verification, restore rehearsal, and what artifacts are safe to copy.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run packages/workflow/src/backup-workflow.test.ts apps/api/src/test/backup.routes.test.ts packages/db/src/test/check.test.ts
npm run db:check
```

Expected: targeted tests and DB check pass.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow/src/backup-workflow.ts packages/workflow/src/backup-workflow.test.ts apps/api/src/routes/backup.routes.ts apps/api/src/test/backup.routes.test.ts packages/db/src/check.ts packages/db/src/test/check.test.ts docs/operations/recovery.md
git commit -m "feat: add backup restore recovery rehearsal"
```

### Task 5: Durable Workflow Replay and Agent Room Trace Completeness

**Files:**
- Modify: `packages/workflow/src/workflow-runner.ts`
- Modify: `packages/workflow/src/workflow-runner.test.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/test/runtime.test.ts`
- Modify: `apps/api/src/routes/agent-room.routes.ts`
- Modify: `apps/api/src/test/agent-room.routes.test.ts`

- [ ] **Step 1: Add replay lineage acceptance**

Test that a failed durable job can be replayed, that replay lineage points to the original run/job, and that Agent Room returns context pack, LLM calls, artifacts, approvals, and durable job state.

- [ ] **Step 2: Wire approvals into persistent Agent Room**

Replace the current empty persistent approval list with repository-backed approval references where available.

- [ ] **Step 3: Verify**

Run:

```bash
npx vitest run packages/workflow/src/workflow-runner.test.ts apps/api/src/test/runtime.test.ts apps/api/src/test/agent-room.routes.test.ts
```

Expected: targeted tests pass and Agent Room no longer drops approval trace data in persistent runtime.

- [ ] **Step 4: Commit**

```bash
git add packages/workflow/src/workflow-runner.ts packages/workflow/src/workflow-runner.test.ts apps/api/src/runtime.ts apps/api/src/test/runtime.test.ts apps/api/src/routes/agent-room.routes.ts apps/api/src/test/agent-room.routes.test.ts
git commit -m "feat: complete durable replay trace data"
```

### Task 6: Governance Gates at Workflow Boundaries

**Files:**
- Modify: `packages/workflow/src/writing-workflow.ts`
- Modify: `packages/workflow/src/writing-workflow.test.ts`
- Modify: `packages/workflow/src/import-workflow.ts`
- Modify: `packages/workflow/src/import-export.test.ts`
- Modify: `packages/workflow/src/revision-recheck.ts`
- Modify: `packages/workflow/src/revision-recheck.test.ts`
- Modify: `apps/api/src/routes/writing-runs.routes.ts`
- Modify: `apps/api/src/test/writing-runs.routes.test.ts`

- [ ] **Step 1: Add failing tests for boundary enforcement**

Cover generation, import, revision, and accept-draft boundaries. High-risk canon mutation, protected sample inclusion, or missing approval must yield a blocked result with traceable reasons.

- [ ] **Step 2: Implement gate composition**

Use existing `auditAuthorshipTransition`, `enforceSourcePolicyForGeneration`, and `evaluateSimilarityGuard` helpers. Do not duplicate rule logic.

- [ ] **Step 3: Surface blockers through API**

Writing run responses must include governance blockers and approval requirements when the workflow is blocked or needs review.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run packages/workflow/src/writing-workflow.test.ts packages/workflow/src/import-export.test.ts packages/workflow/src/revision-recheck.test.ts apps/api/src/test/writing-runs.routes.test.ts
```

Expected: targeted tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/workflow/src/writing-workflow.ts packages/workflow/src/writing-workflow.test.ts packages/workflow/src/import-workflow.ts packages/workflow/src/import-export.test.ts packages/workflow/src/revision-recheck.ts packages/workflow/src/revision-recheck.test.ts apps/api/src/routes/writing-runs.routes.ts apps/api/src/test/writing-runs.routes.test.ts
git commit -m "feat: enforce governance at workflow boundaries"
```

### Task 7: Retrieval and Narrative Quality Fixtures

**Files:**
- Create: `packages/evaluation/src/fixtures/longform-corpus.ts`
- Modify: `packages/evaluation/src/retrieval-regression.test.ts`
- Modify: `packages/evaluation/src/retrieval-regression.ts`
- Modify: `apps/api/src/routes/retrieval.routes.ts`
- Modify: `apps/api/src/test/retrieval.routes.test.ts`
- Modify: `apps/web/src/components/RetrievalEvaluationPanel.tsx`
- Modify: `apps/web/src/test/RetrievalEvaluationPanel.test.tsx`

- [ ] **Step 1: Add seeded corpus fixtures**

Create fixtures with must-include canon facts, forbidden source samples, promises, secrets, and retrieval queries.

- [ ] **Step 2: Add thresholded regression results**

Regression results must include `thresholds`, `includedIds`, `excludedIds`, `failures`, and `triageHints`.

- [ ] **Step 3: Expose failure triage in API and UI**

The panel must show why a run failed and what source/policy item caused it.

- [ ] **Step 4: Verify**

Run:

```bash
npx vitest run packages/evaluation/src/retrieval-regression.test.ts apps/api/src/test/retrieval.routes.test.ts apps/web/src/test/RetrievalEvaluationPanel.test.tsx
```

Expected: targeted tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/evaluation/src packages/retrieval/src apps/api/src/routes/retrieval.routes.ts apps/api/src/test/retrieval.routes.test.ts apps/web/src/components/RetrievalEvaluationPanel.tsx apps/web/src/test/RetrievalEvaluationPanel.test.tsx
git commit -m "feat: add retrieval quality regression triage"
```

### Task 8: Observability Over Real Persisted Data

**Files:**
- Modify: `packages/evaluation/src/observability.ts`
- Modify: `packages/evaluation/src/evaluation-runner.test.ts`
- Modify: `apps/api/src/routes/observability.routes.ts`
- Modify: `apps/api/src/test/observability.routes.test.ts`
- Modify: `apps/web/src/components/ObservabilityDashboard.tsx`
- Modify: `apps/web/src/test/observability-dashboard.test.tsx`

- [ ] **Step 1: Add real-data aggregation test**

Use persisted agent runs, LLM logs, workflow runs, context packs, and adoption markers to calculate cost, tokens, latency, reliability, quality, context pressure, and backup/migration health.

- [ ] **Step 2: Implement missing aggregate fields**

Do not use demo counters. If a signal is unavailable, return an explicit `Unknown`/`InsufficientData` state.

- [ ] **Step 3: Verify**

Run:

```bash
npx vitest run packages/evaluation/src/evaluation-runner.test.ts apps/api/src/test/observability.routes.test.ts apps/web/src/test/observability-dashboard.test.tsx
```

Expected: targeted tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/evaluation/src apps/api/src/routes/observability.routes.ts apps/api/src/test/observability.routes.test.ts apps/web/src/components/ObservabilityDashboard.tsx apps/web/src/test/observability-dashboard.test.tsx
git commit -m "feat: aggregate persisted observability signals"
```

### Task 9: External Blockers and Operator Handoff

**Files:**
- Create: `docs/operations/external-blockers.md`
- Modify: `README.md` if it exists; otherwise create `README.md`

- [ ] **Step 1: Record blockers**

Document:

- Real OpenAI-compatible API key and model budget approval.
- GitHub repository secrets for CI real-provider smoke tests.
- Code signing and release channel decisions for desktop packaging.
- OS keychain library decision.
- Representative manuscript corpus and quality threshold decisions.

- [ ] **Step 2: Record commands to resume**

Include:

```bash
git switch codex/production-hardening
npm run verify:local
```

- [ ] **Step 3: Commit**

```bash
git add docs/operations/external-blockers.md README.md
git commit -m "docs: record production hardening blockers"
```

### Task 10: Final Verification and Push

**Files:**
- No direct file edits unless verification reveals failures.

- [ ] **Step 1: Run full verification**

```bash
npm run verify:local
```

Expected: all checks pass.

- [ ] **Step 2: Inspect git state**

```bash
git status --short --branch
git log --oneline --decorate -n 8
```

Expected: clean worktree on `codex/production-hardening`.

- [ ] **Step 3: Push**

```bash
git push origin codex/production-hardening
```

Expected: branch pushed without force.

- [ ] **Step 4: If safe and requested by the operator's original night instruction, fast-forward main**

Only if verification passes and `origin/main` is an ancestor of this branch:

```bash
git fetch --all --prune
git switch main
git merge --ff-only codex/production-hardening
git push origin main
```

Expected: no force push, main updated by fast-forward only.

## Self-Review

- This plan prioritizes repository-local work that can proceed without the sleeping operator.
- External dependencies are explicit blockers, not stopping points.
- Each task has concrete files, tests, commands, and commit boundaries.
- Parallel subagents may inspect or implement disjoint workstreams, but final integration must run the full verification gate.
