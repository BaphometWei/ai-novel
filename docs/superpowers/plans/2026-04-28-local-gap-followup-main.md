# Local Gap Follow-Up On Main Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the additional local-only gaps found after the strict local hardening merge to `main`.

**Architecture:** Keep the existing persistent Fastify + SQLite + filesystem artifact runtime as the production-like path. Strengthen backup portability, rehearsal coverage, explicit test/demo harness boundaries, real local browser coverage, and pre-send context inspection design without calling external providers.

**Tech Stack:** TypeScript, Fastify, React, Vitest, Playwright, Drizzle SQLite, filesystem artifact store.

---

## Acceptance Matrix

1. Portable backup is accepted only when a backup contains enough artifact content to restore into a different artifact root and still read restored chapter body text.
2. Local production rehearsal is accepted only when it exercises fake-provider writing through the persistent API before backup/verify/restore.
3. `buildApp()` default fake/mock behavior is accepted only when the API surface distinguishes explicit test/demo harness behavior from production-like missing dependencies.
4. Frontend empty/error states are accepted only when Narrative Intelligence and project external-model policy errors are visible instead of silent.
5. Real-local E2E follow-up is accepted only when at least Agent Room and Settings/Decision/Search have non-route-mock browser coverage through the local API where deterministic API surfaces exist.
6. Pre-send external-context inspection is accepted for this batch only as a design/spike note with concrete validation steps; full two-step execution is intentionally deferred.
7. Real local Search coverage is accepted only when newly created manuscript chapter body text is indexed into local SQLite FTS and returned through `/search` without route mocks.

---

## Task 1: Portable Artifact Backup

**Files:**
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/test/backup.routes.test.ts`
- Modify: `docs/operations/recovery.md`

- [x] **Step 1: Add failing test**

Add a persistent runtime test that creates a project and accepted chapter, creates a backup, restores it into a runtime using a different artifact root, and verifies `GET /chapters/:id/current-body` returns the original body without access to the source artifact root.

- [x] **Step 2: Include artifact content in backup payload**

When building the project snapshot, read each referenced artifact URI from the filesystem artifact store and add an `artifactContents` section with `{ artifactId, uri, hash, text }`.

- [x] **Step 3: Restore artifact content before manuscript rows**

When restoring, write missing artifact text into the target artifact store, preserve/restamp metadata as needed, and then restore manuscripts so restored body artifacts are readable.

- [x] **Step 4: Verify**

Run `npx vitest run apps/api/src/test/backup.routes.test.ts`.

---

## Task 2: Production-Like Fake Provider Rehearsal

**Files:**
- Modify: `apps/api/src/test/local-production-rehearsal.test.ts`
- Possibly modify: `docs/operations/recovery.md`

- [x] **Step 1: Add failing rehearsal assertion**

In the temp persistent runtime rehearsal, generate a draft through `POST /projects/:id/writing-runs`, accept it through the normal endpoint, approve any generated approval if required, and verify the current chapter body contains the deterministic fake provider output.

- [x] **Step 2: Keep rehearsal external-free**

Use the existing persistent runtime fake provider fallback. Do not configure OpenAI settings or any real secrets.

- [x] **Step 3: Verify**

Run `npm run rehearse:local-production`.

---

## Task 3: Explicit `buildApp()` Harness Boundary

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/test/app.test.ts`
- Modify: focused route tests if they rely on default demo behavior

- [x] **Step 1: Add failing tests**

Assert default `buildApp()` reports writing and backup dependencies as not configured for production-like use, while `buildApp({ harnessMode: 'demo' })` preserves deterministic in-memory writing/backup behavior for tests and UI demos.

- [x] **Step 2: Implement harness mode**

Add `harnessMode?: 'strict' | 'demo'` with strict as the default. Demo mode wires the existing fake provider and memory backup dependencies. Strict mode returns explicit dependency-not-configured errors for those endpoints unless dependencies are injected.

- [x] **Step 3: Update tests intentionally**

Only tests that are deliberately exercising demo harness behavior should opt into `harnessMode: 'demo'`.

- [x] **Step 4: Verify**

Run `npx vitest run apps/api/src/test/app.test.ts apps/api/src/test/writing-runs.routes.test.ts apps/api/src/test/backup.routes.test.ts`.

---

## Task 4: Frontend Local Gaps

**Files:**
- Modify: `apps/web/src/components/NarrativeIntelligencePanel.tsx`
- Modify: `apps/web/src/test/NarrativeIntelligencePanel.test.tsx`
- Modify: `apps/web/src/components/ProjectDashboard.tsx`
- Modify: `apps/web/src/test/ProjectDashboard.test.tsx`
- Modify: `tests/e2e/real-local-v3-panels.spec.ts` or create a focused real-local spec

- [x] **Step 1: Add failing component tests**

Assert empty narrative data shows clear no-promise/no-closure states. Assert external-model policy update errors are displayed and the UI returns to the loaded policy state.

- [x] **Step 2: Implement visible states**

Render explicit empty states for API-backed empty narrative summaries and catch/display policy update failures.

- [x] **Step 3: Add real-local browser coverage**

Add deterministic no-`page.route` coverage for Agent Room plus Settings/Decision/Search paths that can be exercised against the local API without external services.

- [x] **Step 4: Verify**

Run `npx vitest run apps/web/src/test/NarrativeIntelligencePanel.test.tsx apps/web/src/test/ProjectDashboard.test.tsx` and the focused Playwright spec.

---

## Task 5: Pre-Send Context Inspection Design Spike

**Files:**
- Create: `docs/superpowers/specs/2026-04-28-pre-send-context-inspection-design.md`

- [x] **Step 1: Document recommended two-phase design**

Specify `prepare` then `execute` flow for external providers only, keeping fake/local providers single-step for deterministic automation unless explicitly requested.

- [x] **Step 2: Record validation checklist**

List required spike checks: writing route compatibility, orchestration compatibility, UI confirmation state, budget/source warnings, and no-external-model interaction.

- [x] **Step 3: Mark deferred scope**

State that full implementation is deferred until the spike confirms the route split and UX behavior.

---

## Task 6: Real Local Manuscript Search Index

**Files:**
- Modify: `apps/api/src/services/manuscript.service.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/test/manuscripts.routes.test.ts`
- Modify: `tests/e2e/real-local-v3-panels.spec.ts`

- [x] **Step 1: Add failing API regression**

Create a persistent runtime test that posts an inline-body chapter, calls `/search` with a body term, and expects the created manuscript version to be returned as a `manuscript` result.

- [x] **Step 2: Index manuscript versions**

Add an optional manuscript search indexer dependency and wire persistent runtime to the SQLite `SearchRepository`.

- [x] **Step 3: Exercise through real local browser**

Use the no-route-mock Playwright follow-up to search for a seeded chapter term through the Project Dashboard.

- [x] **Step 4: Verify focused coverage**

Run `npx vitest run apps/api/src/test/manuscripts.routes.test.ts -t "indexes inline chapter body text"` and the focused Playwright test.

---

## Task 7: Verification And Push

**Files:**
- All touched files.

- [x] **Step 1: Run focused checks**

Run all focused commands listed above.

- [x] **Step 2: Run full local gate**

Run `npm run verify:local`.

- [x] **Step 3: Commit and push**

Commit on `main` and push with a normal non-force `git push origin main`.
