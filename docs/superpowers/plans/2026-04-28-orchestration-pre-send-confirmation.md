# Orchestration Pre-Send Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add prepare/execute/cancel confirmation for external-provider orchestration runs while preserving fake/local single-step orchestration.

**Architecture:** Reuse the writing pre-send pattern. Persist prepared orchestration handles in durable jobs, use the existing provider runtime inspection API for budget and blocking reasons, and keep Agent Room as the UI surface for orchestration send confirmation.

**Tech Stack:** TypeScript, Fastify, React, Vitest, Playwright, SQLite repositories, durable jobs, provider runtime.

---

## Task 1: API Tests First

**Files:**
- Modify: `apps/api/src/test/agent-orchestration.service.test.ts`
- Modify: `apps/api/src/test/orchestration.routes.test.ts`
- Modify: `apps/api/src/test/runtime.test.ts`

- [x] **Step 1: Add failing persistence tests**

Add tests for direct external single-step `409 requiresInspection`, prepare without provider fetch, cancel without provider fetch, execute with one provider fetch, and blocked disabled-project prepared sends.

- [x] **Step 2: Add failing route delegation tests**

Add route tests for `/orchestration/runs/prepare`, `/orchestration/runs/:preparedRunId/execute`, and `/orchestration/runs/:preparedRunId/cancel`.

- [x] **Step 3: Update runtime external-provider tests**

Change the existing OpenAI-configured orchestration tests to use prepare/execute instead of direct single-step execution.

## Task 2: Service and Routes

**Files:**
- Modify: `apps/api/src/services/agent-orchestration.service.ts`
- Modify: `apps/api/src/routes/orchestration.routes.ts`
- Modify: `apps/api/src/runtime.ts`

- [x] **Step 1: Add prepared orchestration types**

Add `PreparedAgentOrchestrationRun`, execute/cancel input types, and service methods.

- [x] **Step 2: Add provider inspection to orchestration service**

Support a provider runtime with `createGateway` and `inspectSend`. Direct external single-step runs fail with pre-send required before network calls.

- [x] **Step 3: Persist prepare/execute/cancel**

Prepare creates a context pack, queued agent run, and paused durable job. Execute reuses the prepared context and records output, workflow, LLM calls, confirmation metadata, and succeeded job state. Cancel marks job and agent run cancelled.

- [x] **Step 4: Wire route status mapping**

Map missing handles to 404, pre-send required and stale/cancelled/unconfirmed/budget/missing-secret errors to 409 except disabled project, which remains 403.

## Task 3: Client and Agent Room UI

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/AgentRoom.tsx`
- Modify: `apps/web/src/test/AgentRoom.test.tsx`

- [x] **Step 1: Add failing client/UI tests**

Test API client serialization and Agent Room prepare/confirm/cancel rendering.

- [x] **Step 2: Add client methods and adapters**

Add orchestration input/result/prepared types and methods for prepare, execute, cancel, and start.

- [x] **Step 3: Add Agent Room confirmation controls**

Render a compact pre-send inspection panel with provider/model, context pack, budget, warnings, blockers, context sections, citations, exclusions, and retrieval trace. Confirm executes, cancel clears state.

## Task 4: E2E and Verification

**Files:**
- Modify: `tests/e2e/real-local-v3-panels.spec.ts`
- Modify: `docs/superpowers/specs/2026-04-28-pre-send-context-inspection-design.md`

- [x] **Step 1: Add real local browser coverage**

Extend the real local Agent Room flow to prepare and confirm an orchestration run against the local API without route mocks.

- [x] **Step 2: Update status docs**

Mark orchestration prepare/execute as implemented locally in the pre-send context inspection design note.

- [x] **Step 3: Run focused checks**

Run:

```powershell
npx vitest run apps/api/src/test/agent-orchestration.service.test.ts apps/api/src/test/orchestration.routes.test.ts apps/api/src/test/runtime.test.ts apps/web/src/test/AgentRoom.test.tsx
npx playwright test tests/e2e/real-local-v3-panels.spec.ts
```

- [x] **Step 4: Run full local gate**

Run:

```powershell
npm run verify:local
```

- [x] **Step 5: Commit and push**

Run normal non-force `git push origin main` after verification passes.
