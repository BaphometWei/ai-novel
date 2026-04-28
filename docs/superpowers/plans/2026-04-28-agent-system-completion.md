# Agent System Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining agent-system work so writing, review, governance, durable execution, recovery, intelligence state, observability, browser acceptance, commits, and push all close on `main`.

**Architecture:** Make persistent runtime the source of truth. Every agent-producing workflow builds server-side context, persists AgentRun/WorkflowRun/DurableJob/LLM/artifact traces, routes risky mutations through approvals, and exposes the same state to Agent Room, Decision Queue, editor, review, observability, backup, and E2E flows.

**Tech Stack:** TypeScript, Fastify, React, Vitest, Playwright, Drizzle SQLite, workspace npm scripts.

---

## Non-Negotiable Execution Rules

- Work on `main` unless a blocking git state forces a short-lived `codex/agent-system-completion-*` branch.
- Do not force push.
- Do not delete real data.
- Do not call paid or real provider APIs during automated verification. Use fake providers, injected fetch, or recorded local fixtures.
- Record external blockers in `docs/operations/external-blockers.md` for credentials, accounts, certificates, paid provider validation, or product decisions.
- Keep commits frequent. Each task below has an intended commit boundary.
- Every delegated prompt must explicitly say: `Delegated subagent task`. Include scope, allowed local actions, owned files, and expected output.
- Workers are not alone in the codebase. They must not revert unrelated edits and must accommodate changes made by other workers.
- Before claiming complete, run the exact verification commands listed in Task 10.

## Current Baseline

- Current branch: `main`.
- Last known pushed commit before this plan: `3926b3b feat: harden project context and agent room trace`.
- Last full verification before this plan: `npm run verify:local` passed with Vitest, build, DB check, and Playwright.
- Remaining gaps were confirmed by three read-only audits:
  - Design/system audit.
  - Backend/runtime audit.
  - Frontend/product-flow audit.

## File Structure Map

### Backend runtime spine

- Modify: `apps/api/src/runtime.ts` - wire persistent services, repositories, worker, context builder, approval effects, observability.
- Modify: `apps/api/src/app.ts` - add dependencies and route registrations when new route contracts are introduced.
- Create: `apps/api/src/services/context-build.service.ts` - server-side context builder using project DB state, search, memory, knowledge, source policy, and retrieval package.
- Create: `apps/api/src/services/writing-run.service.ts` - persistent writing run orchestration with gateway logging, context/artifact persistence, durable job, workflow run, and Agent Room trace.
- Create: `apps/api/src/services/acceptance-workflow.service.ts` - accept draft into manuscript through authorship audit, memory extraction, narrative extraction, approval gates, version history.
- Create: `apps/api/src/services/governance-gate.service.ts` - common approval gate and side-effect coordination.
- Create: `apps/api/src/services/durable-worker.service.ts` - handler registry, claim/run/retry/replay/cancel execution for durable jobs.
- Create: `apps/api/src/services/project-bundle.service.ts` - complete backup/export/import/restore assembly and validation.
- Create: `apps/api/src/services/observability-snapshot.service.ts` - aggregate persisted runtime telemetry into snapshots and summary routes.
- Modify: `apps/api/src/services/provider-runtime.ts` - refresh provider/settings per run and route writing through gateway logging.
- Modify: `apps/api/src/services/manuscript.service.ts` - expose version lookup/body helpers needed by acceptance/review/bundle workflows.
- Modify: `apps/api/src/services/agent-orchestration.service.ts` - remove caller-supplied context as trusted input and persist output artifact metadata.

### API routes

- Modify: `apps/api/src/routes/writing-runs.routes.ts` - call `WritingRunService` instead of bare `runWritingWorkflow`.
- Modify: `apps/api/src/routes/manuscripts.routes.ts` - add draft acceptance endpoint and block direct high-risk accepted versions.
- Modify: `apps/api/src/routes/orchestration.routes.ts` - require server-side context build and role/task validation.
- Modify: `apps/api/src/routes/approvals.routes.ts` - return project-scoped queue data and invoke approval effects.
- Modify: `apps/api/src/routes/governance.routes.ts` - create real approval requests/references from audit gates.
- Modify: `apps/api/src/routes/workflow.routes.ts` - expose worker run, queue list, cancel, replay execution status.
- Modify: `apps/api/src/routes/review-learning.routes.ts` - persist finding decisions and revision rechecks.
- Modify: `apps/api/src/routes/import-export.routes.ts` - enqueue real import/export handlers and expose bundle details.
- Modify: `apps/api/src/routes/backup.routes.ts` - call full bundle assembler/restorer.
- Modify: `apps/api/src/routes/scheduled-backup.routes.ts` - enqueue and execute backup handlers through durable worker.
- Modify: `apps/api/src/routes/narrative-intelligence.routes.ts` - expose persisted promise/secret/arc/timeline/world-rule/dependency/closure state.
- Modify: `apps/api/src/routes/settings.routes.ts` - validate budgets/source policy/provider routing with user-readable errors.
- Modify: `apps/api/src/routes/observability.routes.ts` - read aggregate snapshots and drilldowns.

### Database and repositories

- Modify: `packages/db/src/schema.ts` - add durable scheduling fields, memory candidate rows, approval decision metadata, review action rows, bundle sections, source policy/budget fields if absent.
- Modify: `packages/db/src/repositories/durable-job.repository.ts` - add due query, claim/lease, cancel, retry scheduling, replay lineage helpers.
- Modify: `packages/db/src/repositories/memory.repository.ts` - persist memory candidates and promote approved candidates to canon facts with ledger/source trail.
- Modify: `packages/db/src/repositories/governance.repository.ts` - persist approval references linked to real approval request rows.
- Modify: `packages/db/src/repositories/review.repository.ts` - store finding lifecycle/action records and revision suggestions.
- Modify: `packages/db/src/repositories/project-bundle.repository.ts` - store bundle sections, restore items, hashes, rollback actions.
- Modify: `packages/db/src/repositories/observability.repository.ts` - read/write aggregate snapshots and drilldown facts.
- Modify: `packages/db/src/repositories/settings.repository.ts` - enforce max run cost, max daily cost, max context tokens, and source policy.
- Modify: `packages/db/src/index.ts` - export new tables/types/repositories.

### Workflow packages

- Modify: `packages/workflow/src/writing-workflow.ts` - expose reusable draft/self-check pieces while persistent service owns persistence.
- Create: `packages/workflow/src/durable-queue.ts` - pure durable execution state machine.
- Modify: `packages/workflow/src/durable-job.ts` - include lease, scheduled run time, attempt metadata, cancellation state.
- Modify: `packages/workflow/src/workflow-runner.ts` - checkpoint step appending and resumable execution contracts.
- Modify: `packages/workflow/src/memory-extraction-workflow.ts` - return promotable candidates and approval risk metadata.
- Modify: `packages/workflow/src/revision-recheck.ts` - support persisted action lifecycle.
- Modify: `packages/workflow/src/import-workflow.ts` - handler contract for durable import.
- Modify: `packages/workflow/src/export-workflow.ts` - handler contract for durable export.
- Modify: `packages/workflow/src/backup-workflow.ts` - full bundle backup/restore workflow.
- Modify: `packages/workflow/src/agents.ts` - role registry and task compatibility checks.
- Modify: `packages/workflow/src/index.ts` - export new workflow types.

### LLM gateway and retrieval

- Modify: `packages/llm-gateway/src/gateway.ts` - retry/backoff/timeouts, cumulative budget accounting, redacted errors, call logs across attempts.
- Modify: `packages/llm-gateway/src/openai-provider.ts` - timeout and transient error classification through injected fetch.
- Modify: `packages/retrieval/src/context-builder.ts` - accept server-loaded retrieval items and return traceable warnings/citations already expected by API.
- Modify: `packages/retrieval/src/retrieval-policy.ts` - apply source policy from settings.

### Frontend

- Modify: `apps/web/src/App.tsx` - selected project context and route/panel synchronization.
- Modify: `apps/web/src/api/client.ts` - new endpoints and response adapters.
- Modify: `apps/web/src/components/DecisionQueuePanel.tsx` - API-backed queue with approve/reject, project filter, blocking states.
- Modify: `apps/web/src/components/ProjectDashboard.tsx` - queue counts and blocked workflow indicators.
- Modify: `apps/web/src/components/AgentRoom.tsx` - filters, refresh, approval links/actions, artifact/context inspection.
- Modify: `apps/web/src/components/ManuscriptEditor.tsx` - accept through acceptance workflow, show pending gates/version trace.
- Modify: `apps/web/src/components/ReviewCenter.tsx` - API-backed reports, findings, decisions, convert to task.
- Modify: `apps/web/src/components/RevisionDiff.tsx` - persisted preview/apply/recheck lifecycle.
- Modify: `apps/web/src/components/ReviewLearningPanel.tsx` - real learning events and recurring issue summaries.
- Modify: `apps/web/src/components/BranchRetconPanel.tsx` - no auto-demo run; require explicit author action and project state.
- Modify: `apps/web/src/components/SerializationDesk.tsx` - API-backed plan state.
- Modify: `apps/web/src/components/KnowledgeLibrary.tsx` - API-backed source policy/status visibility.
- Modify: `apps/web/src/components/ObservabilityDashboard.tsx` - filters/drilldowns, unknown/insufficient-data state.
- Modify: `apps/web/src/components/SettingsPanel.tsx` - validation, provider/source/budget guardrails.
- Modify: `apps/web/src/styles.css` - compact operational states without nested card layouts.

### Tests and acceptance

- Add/modify backend tests under `apps/api/src/test/*.test.ts`.
- Add/modify DB tests under `packages/db/src/test/*.test.ts`.
- Add/modify workflow tests under `packages/workflow/src/*.test.ts`.
- Add/modify gateway tests under `packages/llm-gateway/src/*.test.ts`.
- Add/modify web component tests under `apps/web/src/test/*.test.tsx`.
- Modify E2E tests under `tests/e2e/*.spec.ts` to reduce mocked high-value flows and use real local API state.

---

## Task 0: Baseline And Work Coordination

**Files:**
- Modify: `docs/operations/external-blockers.md`
- Test: no test file

- [ ] **Step 1: Confirm clean starting point**

Run:

```powershell
git status --short
git branch --show-current
git log --oneline -5
```

Expected:

```text
main
```

If there are unrelated uncommitted files, leave them alone unless they are generated by this plan.

- [ ] **Step 2: Record execution policy**

Append a dated entry to `docs/operations/external-blockers.md` only when a real external blocker is found. Use this exact shape:

```markdown
## 2026-04-28 Agent System Completion

- Blocker: live provider validation is not executed by automation.
  Owner needed: operator with provider credentials and budget approval.
  Local fallback used: fake provider and injected fetch tests.
```

Skip this edit if no external blocker has been encountered.

- [ ] **Step 3: Commit only if the blocker log changed**

Run:

```powershell
git add docs/operations/external-blockers.md
git commit -m "docs: record agent system external blockers"
```

Expected: a commit is created only when the file changed.

---

## Task 1: Persistent Writing Runs And Mandatory Context Builder

**Files:**
- Create: `apps/api/src/services/context-build.service.ts`
- Create: `apps/api/src/services/writing-run.service.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/writing-runs.routes.ts`
- Modify: `apps/api/src/routes/orchestration.routes.ts`
- Modify: `apps/api/src/services/agent-orchestration.service.ts`
- Modify: `packages/workflow/src/writing-workflow.ts`
- Modify: `packages/workflow/src/agents.ts`
- Test: `apps/api/src/test/writing-runs.persistence.test.ts`
- Test: `apps/api/src/test/orchestration.context-builder.test.ts`
- Test: `packages/workflow/src/agents.test.ts`

- [ ] **Step 1: Write failing tests for persistent writing runs**

Create `apps/api/src/test/writing-runs.persistence.test.ts` with assertions that persistent runtime:

```ts
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('persistent writing runs', () => {
  it('persists context, agent run, workflow run, artifacts, durable job, and llm logs', async () => {
    const runtime = await createPersistentApiRuntime(':memory:', {
      fallbackProvider: {
        name: 'fake',
        async generateText() {
          return { text: 'The accepted test draft remains only a draft.', usage: { inputTokens: 10, outputTokens: 8 } };
        },
        async generateStructured<T>() {
          return { value: { summary: 'Passes contract', passed: true, findings: [] } as T, usage: { inputTokens: 4, outputTokens: 3 } };
        },
        async *streamText() {
          yield 'unused';
        },
        async embedText() {
          return { vector: [0.1], model: 'fake-embedding' };
        },
        estimateCost(input) {
          return { estimatedUsd: (input.inputTokens + input.outputTokens) / 1000000 };
        }
      }
    });

    await seedProjectAndChapter(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/writing-runs',
      payload: {
        target: { manuscriptId: 'manuscript_seed', chapterId: 'chapter_seed', range: 'chapter_1' },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft a traceable scene',
          mustWrite: 'Write one scene without promoting canon.',
          wordRange: { min: 100, max: 400 },
          forbiddenChanges: ['Do not alter canon'],
          acceptanceCriteria: ['Creates a draft artifact']
        },
        retrieval: { query: 'traceable scene', maxContextItems: 4, maxSectionChars: 1200 }
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.status).toBe('AwaitingAcceptance');
    expect(body.agentRunId).toMatch(/^agent_run_/);
    expect(body.durableJobId).toMatch(/^job_/);
    expect(body.workflowRunId).toMatch(/^workflow_run_/);
    expect(body.contextPack.id).toMatch(/^context_pack_/);

    expect(await runtime.stores.agentRuns.findById(body.agentRunId)).toMatchObject({ status: 'Succeeded' });
    expect(await runtime.stores.contextPacks.findById(body.contextPack.id)).toBeTruthy();
    expect(await runtime.stores.workflow.workflowRuns.findById(body.workflowRunId)).toBeTruthy();
    expect(await runtime.stores.workflow.durableJobs.findById(body.durableJobId)).toMatchObject({ status: 'Succeeded' });
    expect(await runtime.stores.agentRuns.llmCallLogs.findByAgentRunId(body.agentRunId)).toHaveLength(2);

    runtime.database.client.close();
    await runtime.app.close();
  });
});
```

Add local `seedProjectAndChapter` helper in the test using direct SQLite inserts matching `apps/api/src/test/approvals.persistence.test.ts`.

- [ ] **Step 2: Write failing tests that orchestration rejects caller context**

Create `apps/api/src/test/orchestration.context-builder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('orchestration context source', () => {
  it('builds context server-side and ignores caller supplied context sections', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    await seedProject(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/orchestration/runs',
      payload: {
        projectId: 'project_seed',
        workflowType: 'chapter.plan',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan with server context',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        retrieval: { query: 'server context' },
        contextSections: [{ name: 'caller_context', content: 'must not appear' }]
      }
    });

    expect(response.statusCode).toBe(201);
    const detail = response.json();
    expect(JSON.stringify(detail.contextPack.sections)).not.toContain('must not appear');
    expect(detail.contextPack.retrievalTrace.join('\\n')).toContain('query:server context');

    runtime.database.client.close();
    await runtime.app.close();
  });
});
```

- [ ] **Step 3: Implement context build service**

Create `apps/api/src/services/context-build.service.ts` with:

```ts
import { buildContextPack } from '@ai-novel/retrieval';
import type { ContextPack, EntityId, RiskLevel } from '@ai-novel/domain';
import type { SearchStore } from '../routes/search.routes';
import type { SettingsService } from './settings.service';

export interface ServerContextBuildInput {
  projectId: EntityId<'project'>;
  taskGoal: string;
  agentRole: string;
  riskLevel: RiskLevel;
  query: string;
  maxContextItems?: number;
  maxSectionChars?: number;
}

export interface ContextBuildService {
  build(input: ServerContextBuildInput): Promise<ContextPack>;
}

export function createContextBuildService(input: {
  search: Pick<SearchStore, 'search'>;
  settingsService: SettingsService;
}): ContextBuildService {
  return {
    async build(request) {
      const sourcePolicy = await input.settingsService.loadSourcePolicyDefaults();
      const results = await input.search.search({
        projectId: request.projectId,
        query: request.query,
        types: ['manuscript', 'canon', 'knowledge', 'review', 'runs'],
        limit: request.maxContextItems ?? 8
      });
      const items = results.map((result) => ({
        id: result.id,
        entityKey: result.id,
        text: result.snippet,
        status: 'Confirmed' as const,
        source: result.type,
        sourcePolicy
      }));

      return buildContextPack({
        projectId: request.projectId,
        taskGoal: request.taskGoal,
        agentRole: request.agentRole,
        riskLevel: request.riskLevel,
        query: request.query,
        maxContextItems: request.maxContextItems,
        maxSectionChars: request.maxSectionChars,
        items
      });
    }
  };
}
```

Adjust the exact `SearchStore` type import if the local route exports a narrower type. Keep the public input shape stable.

- [ ] **Step 4: Implement persistent writing run service**

Create `apps/api/src/services/writing-run.service.ts` that:

- Validates the project exists.
- Calls `ContextBuildService.build`.
- Calls gateway-backed draft generation and self-check.
- Persists context pack and context artifact.
- Persists draft/self-check artifacts.
- Persists AgentRun, LLM call logs, WorkflowRun, DurableJob.
- Returns the existing `WritingWorkflowResult` fields plus `agentRunId`, `workflowRunId`, `durableJobId`, and artifact ids.

Use existing local factories:

```ts
createAgentRun(...)
createArtifactRecord(...)
createContextPack(...)
createDurableJob(...)
createLlmCallRecord(...)
createTaskContract(...)
transitionJob(...)
new WorkflowRunner()
```

Persist the final durable job payload with:

```ts
{
  projectId,
  target,
  contextPackId,
  agentRunId,
  workflowRunId,
  draftArtifactId,
  selfCheckArtifactId,
  status: 'AwaitingAcceptance'
}
```

- [ ] **Step 5: Wire runtime and routes**

Modify `apps/api/src/runtime.ts` so `buildApp` receives:

```ts
writingRuns: createPersistentWritingRunService({
  projects: projectService,
  contextBuildService,
  providerRuntime,
  contextPacks,
  artifacts,
  artifactContent,
  agentRuns,
  llmCallLogs,
  workflowRuns,
  durableJobs
})
```

Modify `apps/api/src/routes/writing-runs.routes.ts` to call `dependencies.start(input)` when a service is provided. Keep the current pure workflow fallback for unit tests that inject `provider` and `buildContext`.

- [ ] **Step 6: Add role registry enforcement**

Extend `packages/workflow/src/agents.ts` so orchestration rejects unsupported role/task pairs:

```ts
export function assertAgentCanRunTask(agentRole: string, taskType: string): void {
  const role = agentRegistry.find((agent) => agent.name === agentRole);
  if (!role) throw new Error(`Unknown agent role: ${agentRole}`);
  if (!role.taskTypes.includes(taskType)) {
    throw new Error(`Agent role ${agentRole} cannot run task type ${taskType}`);
  }
}
```

Add a Vitest case in `packages/workflow/src/agents.test.ts` for valid and invalid role/task pairs.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm test -- apps/api/src/test/writing-runs.persistence.test.ts apps/api/src/test/orchestration.context-builder.test.ts packages/workflow/src/agents.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add apps/api/src packages/workflow/src
git commit -m "feat: persist writing runs through agent runtime"
```

---

## Task 2: Accepted Prose Governance Pipeline

**Files:**
- Create: `apps/api/src/services/acceptance-workflow.service.ts`
- Create: `apps/api/src/services/governance-gate.service.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/manuscripts.routes.ts`
- Modify: `apps/api/src/routes/approvals.routes.ts`
- Modify: `apps/api/src/routes/governance.routes.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/repositories/memory.repository.ts`
- Modify: `packages/db/src/repositories/governance.repository.ts`
- Modify: `packages/workflow/src/memory-extraction-workflow.ts`
- Test: `apps/api/src/test/accepted-manuscript.governance.test.ts`
- Test: `apps/api/src/test/approvals.governance-integration.test.ts`
- Test: `apps/api/src/test/memory.persistence.test.ts`
- Test: `packages/db/src/test/memory.repository.test.ts`

- [ ] **Step 1: Add failing acceptance workflow test**

Create `apps/api/src/test/accepted-manuscript.governance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('accepted manuscript governance', () => {
  it('accepts a draft through governance and creates pending approvals for high-risk canon changes', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    await seedAcceptedDraftPrerequisites(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/chapters/chapter_seed/accept-draft',
      payload: {
        runId: 'agent_run_seed',
        draftArtifactId: 'artifact_draft_seed',
        body: 'The city crown is destroyed, changing canon.',
        acceptedBy: 'operator'
      }
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.status).toBe('PendingApproval');
    expect(body.versionId).toMatch(/^manuscript_version_/);
    expect(body.approvals.length).toBeGreaterThan(0);

    const queue = await runtime.app.inject({ method: 'GET', url: '/approvals?projectId=project_seed' });
    expect(queue.json().items.some((item: any) => item.targetId === body.versionId)).toBe(true);

    runtime.database.client.close();
    await runtime.app.close();
  });
});
```

- [ ] **Step 2: Add DB candidate schema**

Modify `packages/db/src/schema.ts` to add:

```ts
export const memoryCandidateFacts = sqliteTable('memory_candidate_facts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  text: text('text').notNull(),
  riskLevel: text('risk_level').notNull(),
  status: text('status').notNull(),
  approvalRequestId: text('approval_request_id').references(() => approvalRequests.id),
  sourceReferencesJson: text('source_references_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});
```

Add approval decision metadata columns if they do not already exist:

```ts
decidedAt: text('decided_at'),
decidedBy: text('decided_by'),
decisionNote: text('decision_note')
```

Update repository mapping without breaking existing tests.

- [ ] **Step 3: Implement memory candidate repository methods**

Add methods to `packages/db/src/repositories/memory.repository.ts`:

```ts
saveCandidate(candidate)
findCandidateById(id)
listCandidatesBySource(sourceType, sourceId)
linkCandidateApproval(candidateId, approvalRequestId)
promoteCandidate(candidateId, input)
updateApprovalRequestDecision(id, decision)
```

`promoteCandidate` must:

- Load the candidate.
- Create a `CanonFact` with status `Confirmed`.
- Include source reference `{ type: candidate.sourceType, id: candidate.sourceId }`.
- Include ledger event `{ type: 'promoted_from_candidate', candidateId, approvedBy, approvedAt }`.
- Mark candidate status `Promoted`.

- [ ] **Step 4: Implement governance gate service**

Create `apps/api/src/services/governance-gate.service.ts` with:

```ts
export interface GovernanceGateRequest {
  projectId: string;
  targetType: string;
  targetId: string;
  riskLevel: 'Medium' | 'High' | 'Blocking';
  reason: string;
  proposedAction: string;
  sourceRunId?: string;
}

export interface GovernanceGateResult {
  status: 'Allowed' | 'PendingApproval';
  approvals: Array<{ id: string; status: string; riskLevel: string; reason: string }>;
}
```

The service must save both `approval_requests` and `governance_approval_references` for pending gates. It must return `Allowed` only for low-risk local operations that do not need approval.

- [ ] **Step 5: Implement acceptance workflow service**

Create `apps/api/src/services/acceptance-workflow.service.ts` with `acceptDraft(input)`:

```ts
{
  chapterId,
  runId,
  draftArtifactId,
  body,
  acceptedBy
}
```

Flow:

1. Load chapter/project.
2. Run authorship audit with action `accept_agent_draft`.
3. Save chapter version with status `AcceptedPendingGovernance` when approvals are required.
4. Extract memory candidates from accepted body.
5. Persist memory candidates.
6. Create high-risk approval requests for canon-changing candidates.
7. Save version history linking run, draft artifact, context pack, version, and approval ids.
8. Return `202 PendingApproval` when gates exist, otherwise `201 Accepted`.

- [ ] **Step 6: Apply approval effects**

Modify `apps/api/src/routes/approvals.routes.ts` and repository store so approving a request:

- Persists `decidedAt`, `decidedBy`, and `decisionNote`.
- Updates linked governance references to `Approved`.
- Promotes memory candidates when `targetType` is `memory_candidate_fact`.
- Marks accepted manuscript version authoritative only after all linked blocking approvals are approved.

Rejecting a request:

- Updates linked governance references to `Rejected`.
- Marks linked candidate `Rejected`.
- Leaves manuscript version non-authoritative.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm test -- apps/api/src/test/accepted-manuscript.governance.test.ts apps/api/src/test/approvals.governance-integration.test.ts apps/api/src/test/memory.persistence.test.ts packages/db/src/test/memory.repository.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add apps/api/src packages/db/src packages/workflow/src
git commit -m "feat: gate accepted prose through governance"
```

---

## Task 3: API-Backed Decision Queue And Project Context

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/DecisionQueuePanel.tsx`
- Modify: `apps/web/src/components/ProjectDashboard.tsx`
- Modify: `apps/web/src/components/AgentRoom.tsx`
- Modify: `apps/web/src/components/ManuscriptEditor.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/test/decision-queue-panel.test.tsx`
- Test: `apps/web/src/test/project-context.test.tsx`
- Test: `apps/web/src/test/manuscript-editor.test.tsx`
- Test: `tests/e2e/workspace.spec.ts`

- [ ] **Step 1: Write failing Decision Queue tests**

Create `apps/web/src/test/decision-queue-panel.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DecisionQueuePanel } from '../components/DecisionQueuePanel';

describe('DecisionQueuePanel', () => {
  it('loads pending approvals and approves an item', async () => {
    const approve = vi.fn(async () => ({ id: 'approval_1', title: 'Promote canon', status: 'Approved' }));
    const client = {
      listPendingApprovals: vi.fn(async () => [
        {
          id: 'approval_1',
          projectId: 'project_1',
          title: 'Promote canon',
          riskLevel: 'High',
          reason: 'Canon change',
          proposedAction: 'Promote candidate',
          status: 'Pending',
          createdAt: '2026-04-28T00:00:00.000Z'
        }
      ]),
      approve,
      reject: vi.fn()
    };

    render(<DecisionQueuePanel client={client} projectId="project_1" />);
    expect(await screen.findByText('Promote canon')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /approve promote canon/i }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('approval_1', expect.any(Object)));
    await waitFor(() => expect(screen.queryByText('Promote canon')).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Extend API client**

Ensure `apps/web/src/api/client.ts` supports:

```ts
listPendingApprovals(projectId?: string): Promise<ApprovalItem[]>
approve(id: string, input?: { decidedBy?: string; note?: string }): Promise<ApprovalItem>
reject(id: string, input?: { decidedBy?: string; note?: string }): Promise<ApprovalItem>
acceptDraft(chapterId: string, input: AcceptDraftInput): Promise<AcceptDraftResult>
```

Adapters must reject malformed responses with `Error`, matching existing client adapter style.

- [ ] **Step 3: Implement queue UI**

Modify `DecisionQueuePanel` props:

```ts
export interface DecisionQueuePanelProps {
  client?: Pick<ApprovalsApiClient, 'listPendingApprovals' | 'approve' | 'reject'>;
  projectId?: string;
  onDecision?: () => void;
}
```

UI behavior:

- Show loading, empty, error, and pending states.
- Filter by `projectId` on the client call if provided.
- Approve/reject buttons must include accessible labels with item title.
- Disable buttons while a decision is posting.
- Remove resolved items after success.

- [ ] **Step 4: Introduce selected project context**

Modify `apps/web/src/App.tsx` so Project Dashboard, Manuscript Editor, Agent Room, Review Center, Decision Queue, Observability, and Settings share one selected project id. Do not let any API-backed panel silently fall back to the first project when the app context has a selected project.

- [ ] **Step 5: Update manuscript acceptance button**

Modify `apps/web/src/components/ManuscriptEditor.tsx` so `Accept draft into manuscript` calls `acceptDraft`, not `addChapterVersion`. Display:

- `Pending approval` when acceptance response status is `PendingApproval`.
- `Accepted` when response status is `Accepted`.
- Linked approval ids in the context inspector.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm test -- apps/web/src/test/decision-queue-panel.test.tsx apps/web/src/test/project-context.test.tsx apps/web/src/test/manuscript-editor.test.tsx
```

Expected: all listed tests pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add apps/web/src tests/e2e
git commit -m "feat: wire decision queue to approval workflow"
```

---

## Task 4: Durable Job Execution Handlers

**Files:**
- Create: `packages/workflow/src/durable-queue.ts`
- Modify: `packages/workflow/src/durable-job.ts`
- Modify: `packages/workflow/src/workflow-runner.ts`
- Modify: `packages/workflow/src/index.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/repositories/durable-job.repository.ts`
- Create: `apps/api/src/services/durable-worker.service.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/routes/workflow.routes.ts`
- Modify: `apps/api/src/routes/import-export.routes.ts`
- Modify: `apps/api/src/routes/backup.routes.ts`
- Modify: `apps/api/src/routes/scheduled-backup.routes.ts`
- Test: `packages/workflow/src/durable-queue.test.ts`
- Test: `apps/api/src/test/workflow-worker.test.ts`

- [ ] **Step 1: Write failing pure durable queue tests**

Create `packages/workflow/src/durable-queue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDurableJob } from './durable-job';
import { claimJob, failJobForRetry, completeJob, cancelJob } from './durable-queue';

describe('durable queue state machine', () => {
  it('claims queued jobs, schedules retry, completes, and cancels without losing payload', () => {
    const queued = createDurableJob({ workflowType: 'writing.run', payload: { projectId: 'project_1' } });
    const claimed = claimJob(queued, { workerId: 'worker_1', now: '2026-04-28T00:00:00.000Z', leaseMs: 30000 });
    expect(claimed.status).toBe('Running');
    expect(claimed.payload.projectId).toBe('project_1');

    const retry = failJobForRetry(claimed, { error: 'transient', now: '2026-04-28T00:00:01.000Z', delayMs: 60000 });
    expect(retry.status).toBe('Retrying');
    expect(retry.retryCount).toBe(1);
    expect(retry.payload.lastError).toBe('transient');

    expect(completeJob(claimed, { output: { ok: true } }).status).toBe('Succeeded');
    expect(cancelJob(claimed, { reason: 'operator' }).status).toBe('Cancelled');
  });
});
```

- [ ] **Step 2: Extend durable job table and domain**

Add fields in `packages/db/src/schema.ts`:

```ts
availableAt: text('available_at'),
leaseOwner: text('lease_owner'),
leaseExpiresAt: text('lease_expires_at'),
cancelRequestedAt: text('cancel_requested_at'),
lastError: text('last_error')
```

Update `packages/workflow/src/durable-job.ts` durable job type with the same optional fields.

- [ ] **Step 3: Implement repository queue operations**

Add to `DurableJobRepository`:

```ts
listDue(now: string, limit: number): Promise<DurableJob[]>
claimNext(input: { workflowTypes?: string[]; workerId: string; now: string; leaseMs: number }): Promise<DurableJob | null>
markCancelRequested(id: string, now: string): Promise<DurableJob | null>
```

`claimNext` must only claim `Queued` or due `Retrying` jobs with no active lease.

- [ ] **Step 4: Implement durable worker service**

Create `apps/api/src/services/durable-worker.service.ts`:

```ts
export interface DurableJobHandler {
  workflowType: string;
  run(job: DurableJob, signal: { isCancellationRequested(): Promise<boolean> }): Promise<Record<string, unknown>>;
}

export interface DurableWorkerService {
  runOnce(input?: { workerId?: string; now?: string }): Promise<{ claimed: number; completed: number; failed: number }>;
  replay(id: string): Promise<DurableJob>;
  cancel(id: string, reason: string): Promise<DurableJob | null>;
}
```

Register handlers for:

- `writing.run`
- `review.report`
- `import.project`
- `export.bundle`
- `backup.create`
- `backup.restore`
- `evaluation.retrieval`

If a handler is not implemented yet in this task, it must fail the job with a clear `Unsupported workflow type: <type>` error and keep the worker alive.

- [ ] **Step 5: Wire routes**

Add workflow routes:

- `POST /workflow/worker/run-once`
- `POST /workflow/jobs/:id/cancel`
- `POST /workflow/jobs/:id/replay` must create and execute a replay lineage job when worker is available.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm test -- packages/workflow/src/durable-queue.test.ts apps/api/src/test/workflow-worker.test.ts apps/api/src/test/workflow.routes.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add packages/workflow/src packages/db/src apps/api/src
git commit -m "feat: execute durable jobs with resumable worker"
```

---

## Task 5: Real Review And Revision Workflow

**Files:**
- Modify: `apps/api/src/routes/review-learning.routes.ts`
- Create: `apps/api/src/routes/review.routes.ts` if no route currently owns review report lifecycle.
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/repositories/review.repository.ts`
- Modify: `packages/workflow/src/revision-recheck.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/ReviewCenter.tsx`
- Modify: `apps/web/src/components/RevisionDiff.tsx`
- Modify: `apps/web/src/components/ReviewLearningPanel.tsx`
- Test: `apps/api/src/test/review-workflow.routes.test.ts`
- Test: `apps/web/src/test/review-center.test.tsx`
- Test: `apps/web/src/test/revision-diff.test.tsx`

- [ ] **Step 1: Write failing API review workflow test**

Create `apps/api/src/test/review-workflow.routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('review workflow routes', () => {
  it('persists report findings, records decisions, applies a revision, and rechecks status', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    await seedProjectChapterAndVersion(runtime.database.client);

    const report = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/review-reports',
      payload: {
        manuscriptVersionId: 'manuscript_version_seed',
        profile: { id: 'continuity', name: 'Continuity' },
        findings: [
          {
            id: 'finding_seed',
            manuscriptVersionId: 'manuscript_version_seed',
            category: 'continuity',
            severity: 'High',
            problem: 'Bell appears before it is introduced.',
            evidenceCitations: [{ sourceId: 'chapter_seed', quote: 'bell' }],
            impact: 'Breaks setup',
            fixOptions: ['Introduce the bell earlier'],
            autoFixRisk: 'Medium',
            status: 'Open'
          }
        ],
        qualityScore: { score: 62 }
      }
    });
    expect(report.statusCode).toBe(201);

    const decision = await runtime.app.inject({
      method: 'POST',
      url: '/review/findings/finding_seed/actions',
      payload: { action: 'Accepted', decidedBy: 'operator', reason: 'Valid issue' }
    });
    expect(decision.statusCode).toBe(200);

    const recheck = await runtime.app.inject({
      method: 'POST',
      url: '/review/recheck',
      payload: {
        previousManuscriptVersionId: 'manuscript_version_seed',
        currentManuscriptVersionId: 'manuscript_version_fixed',
        previousFindings: report.json().findings,
        currentFindings: []
      }
    });
    expect(recheck.statusCode).toBe(200);
    expect(recheck.json().statuses[0].status).toBe('Resolved');

    runtime.database.client.close();
    await runtime.app.close();
  });
});
```

- [ ] **Step 2: Add review action persistence**

Extend schema with:

```ts
export const reviewFindingActions = sqliteTable('review_finding_actions', {
  id: text('id').primaryKey(),
  findingId: text('finding_id').notNull(),
  projectId: text('project_id').notNull().references(() => projects.id),
  action: text('action').notNull(),
  decidedBy: text('decided_by'),
  reason: text('reason'),
  createdTaskId: text('created_task_id'),
  occurredAt: text('occurred_at').notNull()
});
```

Repository must update finding status for actions:

- `Accepted` -> `Accepted`
- `Rejected` -> `Rejected`
- `FalsePositive` -> `FalsePositive`
- `ApplyRevision` -> `Applied`
- `ConvertToTask` -> keep finding open and return a generated task id

- [ ] **Step 3: Implement UI workflow**

`ReviewCenter` must:

- Load reports from API for selected project/version.
- Render finding status and severity.
- Call action endpoints for accept, reject, ask why, apply revision, convert to task.
- Refresh findings after action.

`RevisionDiff` must:

- Load persisted suggestion diff.
- Apply suggestion through API.
- Trigger recheck and show `Resolved`, `Regressed`, or `StillOpen`.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- apps/api/src/test/review-workflow.routes.test.ts apps/web/src/test/review-center.test.tsx apps/web/src/test/revision-diff.test.tsx packages/workflow/src/revision-recheck.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/api/src apps/web/src packages/db/src packages/workflow/src
git commit -m "feat: persist review and revision workflow"
```

---

## Task 6: Full Bundle Backup, Export, Import, And Restore

**Files:**
- Create: `apps/api/src/services/project-bundle.service.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `apps/api/src/routes/backup.routes.ts`
- Modify: `apps/api/src/routes/import-export.routes.ts`
- Modify: `apps/api/src/routes/scheduled-backup.routes.ts`
- Modify: `packages/db/src/repositories/project-bundle.repository.ts`
- Modify: `packages/workflow/src/backup-workflow.ts`
- Modify: `packages/workflow/src/import-workflow.ts`
- Modify: `packages/workflow/src/export-workflow.ts`
- Test: `apps/api/src/test/project-bundle.recovery.test.ts`
- Test: `apps/api/src/test/backup.routes.test.ts`
- Test: `apps/api/src/test/import-export.routes.test.ts`
- Test: `packages/workflow/src/backup-workflow.test.ts`
- Test: `packages/workflow/src/import-export.test.ts`

- [ ] **Step 1: Write failing recovery test**

Create `apps/api/src/test/project-bundle.recovery.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('project bundle recovery', () => {
  it('exports a full project bundle and restores it into an isolated target project', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    await seedRichProject(runtime.database.client);

    const backup = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/backup',
      payload: { reason: 'recovery test', requestedBy: 'test' }
    });
    expect(backup.statusCode).toBe(201);
    expect(backup.json().record.manifest.sections).toEqual(
      expect.arrayContaining(['project', 'manuscripts', 'artifacts', 'canon', 'knowledge', 'settings', 'runs'])
    );

    const restore = await runtime.app.inject({
      method: 'POST',
      url: '/backup/restore',
      payload: { path: backup.json().record.path, targetProjectId: 'project_restored', requestedBy: 'test' }
    });
    expect(restore.statusCode).toBe(201);
    expect(restore.json().record.targetProjectId).toBe('project_restored');

    const restored = await runtime.app.inject({ method: 'GET', url: '/projects/project_restored' });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().id).toBe('project_restored');

    runtime.database.client.close();
    await runtime.app.close();
  });
});
```

- [ ] **Step 2: Implement bundle assembler**

Create `apps/api/src/services/project-bundle.service.ts`:

```ts
export interface ProjectBundleSection {
  name: string;
  hash: string;
  payload: unknown;
}

export interface FullProjectBundle {
  manifest: {
    projectId: string;
    createdAt: string;
    sections: string[];
    sectionHashes: Record<string, string>;
  };
  sections: ProjectBundleSection[];
}
```

Sections must include:

- `project`
- `manuscripts`
- `chapterVersions`
- `artifacts`
- `canon`
- `memoryCandidates`
- `knowledge`
- `sourcePolicies`
- `settings`
- `agentRuns`
- `workflowRuns`
- `durableJobs`
- `llmCallLogs`
- `approvals`
- `review`
- `narrativeState`
- `versionHistory`

- [ ] **Step 3: Implement restore validation**

Restore must:

- Validate bundle hash and every section hash.
- Reject target project id equal to source project id unless request explicitly uses a supported replace mode.
- Write restore items to `project_bundle_restore_items`.
- Create rollback actions for inserted projects, manuscripts, chapters, versions, facts, knowledge, settings, and state records.
- Preserve source ids in payload metadata while using target ids for restored live rows.

- [ ] **Step 4: Wire import/export durable handlers**

Import/export routes must enqueue durable jobs with payload:

```ts
{
  projectId,
  mode,
  sourceUri,
  includeArtifacts,
  requestedBy
}
```

The durable worker must execute the handler and store output hash/path in job payload.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm test -- apps/api/src/test/project-bundle.recovery.test.ts apps/api/src/test/backup.routes.test.ts apps/api/src/test/import-export.routes.test.ts packages/workflow/src/backup-workflow.test.ts packages/workflow/src/import-export.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add apps/api/src packages/db/src packages/workflow/src
git commit -m "feat: restore full project bundles"
```

---

## Task 7: Productize V3 Intelligence Workflows

**Files:**
- Modify: `apps/api/src/routes/narrative-intelligence.routes.ts`
- Modify: `apps/api/src/routes/branch-retcon.routes.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `packages/db/src/repositories/narrative-state.repository.ts`
- Modify: `packages/db/src/repositories/dependency.repository.ts`
- Modify: `packages/db/src/repositories/branch-retcon.repository.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/BranchRetconPanel.tsx`
- Modify: `apps/web/src/components/AgentRoom.tsx`
- Test: `apps/api/src/test/narrative-intelligence.acceptance-integration.test.ts`
- Test: `apps/api/src/test/branch-retcon.routes.test.ts`
- Test: `apps/web/src/test/branch-retcon-panel.test.tsx`

- [ ] **Step 1: Write failing integration test**

Create `apps/api/src/test/narrative-intelligence.acceptance-integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('narrative intelligence acceptance integration', () => {
  it('updates persisted promise, arc, timeline, rule, dependency, and closure state from an accepted manuscript', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    await seedAcceptedNarrativeInput(runtime.database.client);

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/projects/project_seed/narrative-intelligence/extract-from-version',
      payload: { manuscriptVersionId: 'manuscript_version_seed', sourceRunId: 'agent_run_seed' }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().created).toEqual(
      expect.arrayContaining(['promise', 'arc', 'timeline', 'world_rule', 'dependency', 'closure'])
    );

    const summary = await runtime.app.inject({
      method: 'GET',
      url: '/projects/project_seed/narrative-intelligence/summary?currentChapter=1'
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().promiseStates.length).toBeGreaterThan(0);

    runtime.database.client.close();
    await runtime.app.close();
  });
});
```

- [ ] **Step 2: Add extraction endpoint**

Add `POST /projects/:projectId/narrative-intelligence/extract-from-version`:

- Load accepted manuscript version body.
- Extract deterministic local state using existing domain/workflow helpers.
- Save state records for `promise`, `secret`, `arc`, `timeline`, `world_rule`, `dependency`, and `closure`.
- Link source run id and manuscript version id in `snapshotMetadataJson`.

- [ ] **Step 3: Make branch/retcon explicit**

Modify `BranchRetconPanel`:

- Remove automatic demo projection on mount.
- Load scenarios/proposals for selected project.
- Require explicit button actions for project branch, adopt, create retcon, and run regression.
- Show pending approval status when adoption or retcon requires governance.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- apps/api/src/test/narrative-intelligence.acceptance-integration.test.ts apps/api/src/test/branch-retcon.routes.test.ts apps/web/src/test/branch-retcon-panel.test.tsx
```

Expected: all listed tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/api/src apps/web/src packages/db/src
git commit -m "feat: persist narrative intelligence workflows"
```

---

## Task 8: Provider, Source Policy, And Budget Guardrails

**Files:**
- Modify: `packages/llm-gateway/src/gateway.ts`
- Modify: `packages/llm-gateway/src/openai-provider.ts`
- Modify: `apps/api/src/services/provider-runtime.ts`
- Modify: `apps/api/src/routes/settings.routes.ts`
- Modify: `packages/db/src/repositories/settings.repository.ts`
- Modify: `packages/retrieval/src/retrieval-policy.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/SettingsPanel.tsx`
- Modify: `apps/web/src/components/AgentRoom.tsx`
- Modify: `apps/web/src/components/ObservabilityDashboard.tsx`
- Test: `packages/llm-gateway/src/retry-policy.test.ts`
- Test: `apps/api/src/test/settings.routes.test.ts`
- Test: `apps/web/src/test/settings-panel.test.tsx`

- [ ] **Step 1: Write failing gateway retry/budget test**

Create `packages/llm-gateway/src/retry-policy.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { LlmGateway } from './gateway';

describe('LlmGateway retry and budget policy', () => {
  it('retries transient failures, logs attempts, redacts errors, and enforces max run cost', async () => {
    const provider = {
      name: 'fake',
      generateText: vi.fn()
        .mockRejectedValueOnce(new Error('429 api_key secret-123'))
        .mockResolvedValueOnce({ text: 'ok', usage: { inputTokens: 10, outputTokens: 10 } }),
      generateStructured: vi.fn(),
      streamText: vi.fn(),
      embedText: vi.fn(),
      estimateCost: () => ({ estimatedUsd: 0.01 })
    };

    const gateway = new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId: 'prompt_default',
      retryPolicy: { maxAttempts: 2, baseDelayMs: 0 },
      budgetPolicy: { maxRunCostUsd: 1 }
    });

    await expect(gateway.generateText({ prompt: 'hello' })).resolves.toMatchObject({ text: 'ok' });
    expect(provider.generateText).toHaveBeenCalledTimes(2);
    expect(gateway.callLog[0].error).not.toContain('secret-123');
    expect(gateway.callLog.at(-1)?.retryCount).toBe(1);
  });
});
```

- [ ] **Step 2: Implement gateway policy**

`LlmGateway` must:

- Retry transient 429/408/409/425/500/502/503/504 errors and timeouts.
- Stop on schema validation failures unless schema repair is enabled.
- Redact API keys, bearer tokens, and long secret-looking strings in errors.
- Record one call log entry per final operation with retry count, cost, status, and redacted error.
- Enforce `maxRunCostUsd` before and after each attempt.

- [ ] **Step 3: Refresh runtime settings per run**

Modify `provider-runtime.ts` so each gateway creation reads latest provider, model routing, budget policy, and source policy instead of capturing settings only once at startup.

- [ ] **Step 4: Settings UI validation**

`SettingsPanel` must reject:

- Negative budget.
- Zero budget.
- `maxContextTokens` below 512.
- Empty drafting/review model.
- Source policy that disables all allowed sources.

Display API validation messages without showing secrets.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm test -- packages/llm-gateway/src/retry-policy.test.ts apps/api/src/test/settings.routes.test.ts apps/web/src/test/settings-panel.test.tsx
```

Expected: all listed tests pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add packages/llm-gateway/src packages/retrieval/src apps/api/src apps/web/src packages/db/src
git commit -m "feat: enforce provider budget guardrails"
```

---

## Task 9: Product Observability From Real Persisted Data

**Files:**
- Create: `apps/api/src/services/observability-snapshot.service.ts`
- Modify: `apps/api/src/routes/observability.routes.ts`
- Modify: `apps/api/src/runtime.ts`
- Modify: `packages/db/src/repositories/observability.repository.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/components/ObservabilityDashboard.tsx`
- Test: `apps/api/src/test/observability.routes.test.ts`
- Test: `apps/web/src/test/observability-dashboard.test.tsx`

- [ ] **Step 1: Extend observability route test**

Modify `apps/api/src/test/observability.routes.test.ts` to assert:

```ts
expect(summary.workflowBottlenecks).toEqual(expect.any(Array));
expect(summary.runErrors).toEqual(expect.any(Array));
expect(summary.modelUsage).toEqual(expect.any(Array));
expect(summary.dataQuality).toMatchObject({
  openIssueCount: expect.any(Number),
  highSeverityOpenCount: expect.any(Number)
});
expect(summary.quality.status).toBeOneOf(['Measured', 'InsufficientData']);
expect(summary.adoption.status).toBeOneOf(['Measured', 'InsufficientData']);
```

If `toBeOneOf` is not available, use:

```ts
expect(['Measured', 'InsufficientData']).toContain(summary.quality.status);
```

- [ ] **Step 2: Implement snapshot service**

Create `apps/api/src/services/observability-snapshot.service.ts`:

```ts
export interface ObservabilitySnapshotService {
  capture(input: { projectId: string; windowStartAt: string; windowEndAt: string }): Promise<ProductObservabilitySummary>;
  loadSummary(input?: { projectId?: string; windowStartAt?: string; windowEndAt?: string }): Promise<ProductObservabilitySummary>;
}
```

Aggregate:

- AgentRun status counts.
- LLM cost/tokens/model usage.
- Durable job queue depth, retry pressure, cancelled/failed jobs.
- Workflow run step failures.
- Approval pending/approved/rejected counts.
- Review open/high severity findings.
- Backup/restore/import/export recent failures.
- Migration history failures.
- Data-quality warnings.

When a metric lacks source data, return `status: 'InsufficientData'` for that metric instead of inventing rates.

- [ ] **Step 3: Add UI filters and drilldowns**

`ObservabilityDashboard` must:

- Filter by selected project.
- Show cost, latency, tokens, model usage, queue depth, approvals, reviews, backups, migrations.
- Provide drilldown links to Agent Room run id or workflow job id when present.
- Render arrays compactly with stable row heights.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- apps/api/src/test/observability.routes.test.ts apps/web/src/test/observability-dashboard.test.tsx packages/db/src/test/observability.repository.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add apps/api/src apps/web/src packages/db/src
git commit -m "feat: aggregate persisted observability telemetry"
```

---

## Task 10: Real API Browser Acceptance And Final Push

**Files:**
- Modify: `tests/e2e/workspace.spec.ts`
- Create: `tests/e2e/agent-system-real-api.spec.ts`
- Modify: `scripts/verify-local-production.mjs` only if new required checks are missing from the existing local verification script.
- Modify: `docs/superpowers/spikes/2026-04-27-v2-v3-implementation-status.md`
- Modify: `docs/operations/external-blockers.md` if external blockers were encountered.

- [ ] **Step 1: Convert high-value E2E flows to real API**

Create `tests/e2e/agent-system-real-api.spec.ts` with flows:

- Create/select project.
- Create chapter.
- Start writing run.
- Open Agent Room and verify run/context/artifact/cost trace.
- Accept draft and verify Decision Queue pending item when governance requires approval.
- Approve item and verify manuscript/version state updates.
- Create review finding and apply/recheck revision.
- Create backup and verify restore target exists.
- Open Observability and verify real run/job/approval counts.

The test must not mock these API routes:

```text
/projects
/projects/:projectId/writing-runs
/agent-room
/approvals
/workflow
/backup
/observability
```

- [ ] **Step 2: Keep only low-value display mocks**

In `tests/e2e/workspace.spec.ts`, remove mocks for flows now covered by `agent-system-real-api.spec.ts`. Keep display-only mocks only for views whose backend is intentionally out of scope after this plan.

- [ ] **Step 3: Update implementation status doc**

Modify `docs/superpowers/spikes/2026-04-27-v2-v3-implementation-status.md`:

- Mark completed items from Tasks 1-9 as complete.
- Link remaining external blockers to `docs/operations/external-blockers.md`.
- State that live provider validation requires operator credentials and budget approval.

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm run verify:local
```

Expected:

```text
verify-local-production completed successfully
```

If the script prints package-specific summaries instead of that exact line, confirm every step exits with code 0 and no failed test is reported.

- [ ] **Step 5: Inspect git diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only files changed by this plan are listed.

- [ ] **Step 6: Final commit**

Run:

```powershell
git add apps packages tests scripts docs
git commit -m "feat: complete agent system production workflows"
```

If all implementation tasks already committed their changes and only docs changed, use:

```powershell
git add docs
git commit -m "docs: update agent system completion status"
```

- [ ] **Step 7: Push**

Run:

```powershell
git push origin main
```

Expected: push succeeds without force.

---

## Parallelization Plan

Use subagents only after Task 1 establishes shared persistent writing/context contracts.

### Safe first wave after Task 1

- Delegated subagent task A: Task 2 governance pipeline.
  - Owned files: `apps/api/src/services/acceptance-workflow.service.ts`, `apps/api/src/services/governance-gate.service.ts`, `apps/api/src/routes/manuscripts.routes.ts`, memory/governance repository tests.
  - Allowed actions: read repo, edit owned files, run focused tests.
  - Expected output: changed files list, tests run, remaining blockers.

- Delegated subagent task B: Task 4 durable worker.
  - Owned files: `packages/workflow/src/durable-queue.ts`, `packages/workflow/src/durable-job.ts`, `packages/db/src/repositories/durable-job.repository.ts`, `apps/api/src/services/durable-worker.service.ts`, focused tests.
  - Allowed actions: read repo, edit owned files, run focused tests.
  - Expected output: changed files list, tests run, remaining blockers.

- Delegated subagent task C: Task 3 frontend decision/project context.
  - Owned files: `apps/web/src/App.tsx`, `apps/web/src/components/DecisionQueuePanel.tsx`, `apps/web/src/components/ProjectDashboard.tsx`, `apps/web/src/api/client.ts`, focused web tests.
  - Allowed actions: read repo, edit owned files, run focused tests.
  - Expected output: changed files list, tests run, remaining blockers.

### Safe second wave after Tasks 2-4 merge cleanly

- Delegated subagent task D: Task 5 review/revision.
- Delegated subagent task E: Task 6 bundle recovery.
- Delegated subagent task F: Task 8 provider/settings guardrails.

### Keep local in main session

- Runtime integration merges in `apps/api/src/runtime.ts` and `apps/api/src/app.ts`.
- Final E2E conversion.
- Final `npm run verify:local`.
- Final commit and push.

---

## Completion Checklist

- [ ] Writing runs persist AgentRun, WorkflowRun, DurableJob, LLM logs, context packs, and artifacts.
- [ ] All writing/orchestration runs build context server-side.
- [ ] Accepted prose goes through authorship audit, memory extraction, narrative extraction, and approvals before authoritative canon/state promotion.
- [ ] Decision Queue is API-backed and blocks/resolves product workflows.
- [ ] Durable jobs are claimable, retryable, replayable, cancellable, and handler-backed.
- [ ] Review and revision lifecycle is persistent and visible in UI.
- [ ] Backup/export/import/restore includes full project data and validates hashes.
- [ ] V3 narrative intelligence state is fed by accepted/reviewed manuscript state.
- [ ] Provider retry, budget, source policy, and settings validation are enforced.
- [ ] Observability reports real persisted telemetry and marks insufficient data honestly.
- [ ] High-value browser acceptance uses real local API.
- [ ] `npm run verify:local` passes.
- [ ] All changes are committed.
- [ ] `git push origin main` succeeds.

