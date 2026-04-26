# AI Novel Agent Full System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first AI novel creation workspace for Chinese long-form authors with governed memory, reader-promise tracking, agent-assisted authoring, review, serialization, import/export, evaluation, and observability.

**Architecture:** Use a modular monolith with clear package boundaries: React web app, Node TypeScript API, pure domain core, Drizzle repositories, SQLite WAL storage, artifact storage, provider-agnostic LLM gateway, retrieval adapters, durable local jobs, and workflow modules. Domain modules stay independent of UI, database, and model providers; application services orchestrate repositories, artifacts, retrieval, LLM calls, and jobs.

**Tech Stack:** React, Vite, TypeScript, Node.js, Fastify, Zod, Drizzle ORM, SQLite, Vitest, Playwright, TipTap, npm workspaces.

---

## Scope Check

The design document covers a full product with many independent subsystems. The user explicitly requested one full implementation plan and then autonomous first-phase implementation, so this document is a master plan with phase gates. Each phase leaves the product testable and coherent.

This plan uses the design document as the product boundary and technical stack source:

- `docs/superpowers/specs/2026-04-26-ai-novel-agent-full-system-design.md`

## Assumptions

- Work happens in the existing isolated worktree at `C:/Users/Administrator/.config/superpowers/worktrees/ai-novel/feature-ai-novel-agent-system`.
- The current branch is `feature/ai-novel-agent-system`; large implementation work does not happen directly on `main`.
- The initial package manager is `npm` because the repository has no package manager lockfile yet.
- The initial backend HTTP framework is Fastify because the design requests Node/TypeScript API modules and Fastify gives typed local API testing without introducing a larger framework.
- The initial SQLite driver is `better-sqlite3` for direct local SQLite WAL support with Drizzle. If Windows native install fails, switch the SQLite adapter behind the repository boundary and keep domain/API contracts unchanged.
- The origin remote currently uses `git@github.com:BaphometWei/ai-novel.git`. The user supplied `git@github.com-baphometwei:BaphometWei/ai-novel.git`; use the existing origin first, and if push authentication fails, update origin to the user-supplied alias.

## Open Questions

- Whether the final product should be Electron, Tauri, or browser-only with local API. This plan keeps packaging behind later extension boundaries.
- Whether OpenAI should be wired as a real provider in Phase 1 or left as a typed adapter with environment-based configuration. This plan builds the gateway interface and a deterministic fake provider first, then adds real provider calls in the agent phase.
- Whether sample-library similarity checks should use local embeddings only or an external embedding provider. This plan hides that behind the vector retrieval adapter.

## File Structure

Create this repository layout:

```text
apps/
  api/
    src/
      app.ts
      server.ts
      routes/
        health.routes.ts
        projects.routes.ts
        manuscripts.routes.ts
        agent-runs.routes.ts
      services/
        project.service.ts
        manuscript.service.ts
        context-pack.service.ts
      test/
        app.test.ts
    package.json
    tsconfig.json
  web/
    index.html
    src/
      App.tsx
      main.tsx
      api/client.ts
      components/
        AppShell.tsx
        ProjectDashboard.tsx
        ManuscriptNavigator.tsx
        DecisionQueuePanel.tsx
      styles.css
      test/
        App.test.tsx
    package.json
    tsconfig.json
    vite.config.ts
packages/
  domain/
    src/
      index.ts
      shared/
        ids.ts
        result.ts
        clock.ts
        status.ts
      project/
        project.ts
        manuscript.ts
        project.test.ts
        manuscript.test.ts
      artifact/
        artifact.ts
        artifact.test.ts
      agents/
        agent-run.ts
        context-pack.ts
        llm-gateway.ts
        agent-run.test.ts
        context-pack.test.ts
        llm-gateway.test.ts
      memory/
        canon.ts
        approvals.ts
        canon.test.ts
      retrieval/
        retrieval.ts
        retrieval.test.ts
      narrative/
        promises.ts
        secrets.ts
        arcs.ts
        timeline.ts
        rules.ts
        dependencies.ts
        impact.ts
        branches.ts
        closure.ts
        promises.test.ts
        secrets.test.ts
        arcs.test.ts
        timeline.test.ts
        rules.test.ts
        impact.test.ts
        branches.test.ts
        closure.test.ts
    package.json
    tsconfig.json
  db/
    src/
      index.ts
      connection.ts
      schema.ts
      migrate.ts
      repositories/
        project.repository.ts
        manuscript.repository.ts
        artifact.repository.ts
        agent-run.repository.ts
        context-pack.repository.ts
        memory.repository.ts
      test/
        database.test.ts
        project.repository.test.ts
        manuscript.repository.test.ts
        artifact.repository.test.ts
        agent-run.repository.test.ts
        memory.repository.test.ts
    package.json
    tsconfig.json
  artifacts/
    src/
      artifact-store.ts
      filesystem-artifact-store.ts
      hash.ts
      filesystem-artifact-store.test.ts
    package.json
    tsconfig.json
  llm-gateway/
    src/
      index.ts
      fake-provider.ts
      openai-provider.ts
      gateway.ts
      gateway.test.ts
    package.json
    tsconfig.json
  retrieval/
    src/
      index.ts
      keyword-search.ts
      vector-store.ts
      context-builder.ts
      retrieval-policy.ts
      context-builder.test.ts
    package.json
    tsconfig.json
  workflow/
    src/
      index.ts
      task-contract.ts
      durable-job.ts
      copilot-runtime.ts
      authorship.ts
      workflow-runner.ts
      workflow-runner.test.ts
    package.json
    tsconfig.json
  evaluation/
    src/
      evaluation-case.ts
      evaluation-runner.ts
      observability.ts
      evaluation-runner.test.ts
    package.json
    tsconfig.json
tests/
  e2e/
    workspace.spec.ts
drizzle/
  migrations/
docs/
  superpowers/
    plans/
      2026-04-27-ai-novel-agent-full-system-implementation.md
package.json
tsconfig.base.json
vitest.config.ts
playwright.config.ts
drizzle.config.ts
```

## Development Sequence

### Phase 1: Foundation

Build the monorepo, test framework, React shell, Node API, Drizzle/SQLite storage, domain core, Project/Manuscript, Artifact, AgentRun, ContextPack, and LLM Gateway contracts.

Acceptance gate:

- `npm test` passes.
- `npm run build` passes.
- `npm run db:check` creates a temporary SQLite database with WAL enabled.
- Playwright opens the local UI and sees the project dashboard.
- Commit and push the branch.

### Phase 2: Memory and Retrieval

Build CanonFact, memory status transitions, approval requests, conflict records, source references, FTS search, vector adapter, context citations, retrieval trace, and narrative dependency index.

Acceptance gate:

- Canon transition tests prove only allowed transitions are accepted.
- Repository tests prove canon facts require source and confirmation before Canon status.
- Retrieval tests prove Canon outranks Draft, restricted samples are excluded, and context packs record citations plus exclusions.
- Commit and push the branch.

### Phase 3: Narrative Governance Systems

Build Foreshadowing/ReaderPromise, Secrets/Reveals, CharacterArc/RelationshipArc, Timeline/Location/Causality, WorldRule/Power/Constraint, ChangeImpact/Retcon/Regression, BranchSandbox, and Ending/Closure domain services.

Acceptance gate:

- Domain tests cover lifecycle transitions and risk gates for every narrative system.
- Impact tests prove dependency-linked edits produce affected-object reports.
- Branch tests prove scenario outputs remain isolated from canon until adoption.
- Closure tests prove unresolved core promises, arcs, secrets, rules, and antagonist outcomes are surfaced.
- Commit and push the branch.

### Phase 4: Agent Orchestration and Creative Copilot Runtime

Build task contracts, workflow definitions, durable jobs, agent role modules, run graph, Creative Copilot Runtime policy, AuthorshipSession, WritingContract, and A0-A4 authorship controls.

Acceptance gate:

- Workflow tests prove runs are resumable, cancellable, replayable, and inspectable.
- Authorship tests prove agent prose is a draft artifact until accepted.
- Runtime tests prove high-risk events become visible in every mode.
- LLM gateway tests prove structured generation validates schema and logs prompt version, model, cost, and retry metadata.
- Commit and push the branch.

### Phase 5: Writing Workbench, Review, Revision, and Serialization

Build TipTap editor integration, chapter tree, context inspector, decision queue, story bible boards, review findings, diff review, revision suggestions, publish checklist, update calendar, reader feedback import, and serialization strategy.

Acceptance gate:

- Component tests cover dashboard, editor shell, board views, review center, and serialization desk.
- API tests cover manuscript versioning, review findings, revision suggestions, and feedback import.
- Playwright tests cover project creation, chapter draft navigation, review finding display, decision queue, and publish checklist.
- Commit and push the branch.

### Phase 6: Knowledge Library, Import/Export/Backup, Evaluation, Observability

Build KnowledgeItem, Sample, Trope, Technique, StyleProfile, ReviewRule, SourcePolicy, import batches, project bundles, backup/restore, evaluation cases, evaluation results, telemetry, cost dashboards, data-quality issues, and similarity guard boundary.

Acceptance gate:

- SourcePolicy tests prove restricted samples never enter generation context.
- Import tests prove raw artifacts are stored and extracted memory enters Candidate status.
- Export/restore tests prove a project bundle round-trips project metadata, chapters, artifacts, canon, knowledge, run logs, and settings snapshot.
- Evaluation tests prove retrieval and prompt changes can be checked against saved project cases.
- Commit and push the branch.

## Execution Protocol

Use this loop for every module:

1. Write one failing Vitest or Playwright test for one behavior.
2. Run the narrow test and confirm the failure is caused by missing behavior.
3. Build the smallest production code that passes the test.
4. Run the narrow test and the package test suite.
5. Refactor only while tests remain green.
6. Run phase verification commands.
7. Commit and push at each phase gate.

Use these commands:

```bash
npm install
npm test
npm run build
npm run db:check
npm run dev:api
npm run dev:web
npm run test:e2e
```

## Task 1: Monorepo Tooling and Test Harness

**Files:**

- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Test: `packages/domain/src/shared/result.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { fail, ok } from './result';

describe('Result helpers', () => {
  it('represents success and failure without throwing', () => {
    expect(ok('value')).toEqual({ ok: true, value: 'value' });
    expect(fail('bad input')).toEqual({ ok: false, error: 'bad input' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- packages/domain/src/shared/result.test.ts`

Expected: FAIL because `packages/domain/src/shared/result.ts` does not exist.

- [ ] **Step 3: Add root workspace configuration**

```json
{
  "name": "ai-novel",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "dev:api": "npm --workspace @ai-novel/api run dev",
    "dev:web": "npm --workspace @ai-novel/web run dev",
    "db:check": "npm --workspace @ai-novel/db run db:check"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^15.0.0",
    "@types/node": "^20.12.0",
    "@vitejs/plugin-react": "^4.2.0",
    "jsdom": "^24.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.5.0"
  }
}
```

- [ ] **Step 4: Add minimal Result implementation**

```typescript
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- packages/domain/src/shared/result.test.ts`

Expected: PASS with 1 test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts playwright.config.ts apps packages
git commit -m "chore: set up TypeScript monorepo"
```

## Task 2: Domain Core Types

**Files:**

- Create: `packages/domain/src/shared/ids.ts`
- Create: `packages/domain/src/shared/clock.ts`
- Create: `packages/domain/src/shared/status.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/shared/ids.test.ts`
- Test: `packages/domain/src/shared/status.test.ts`

- [ ] **Step 1: Write the failing ID test**

```typescript
import { describe, expect, it } from 'vitest';
import { createId } from './ids';

describe('createId', () => {
  it('prefixes generated ids with the entity type', () => {
    const id = createId('project');
    expect(id).toMatch(/^project_[a-z0-9]+$/);
  });
});
```

- [ ] **Step 2: Write the failing status test**

```typescript
import { describe, expect, it } from 'vitest';
import { canTransitionMemoryStatus } from './status';

describe('canTransitionMemoryStatus', () => {
  it('allows only governed memory transitions', () => {
    expect(canTransitionMemoryStatus('Candidate', 'Draft')).toBe(true);
    expect(canTransitionMemoryStatus('Draft', 'Canon')).toBe(true);
    expect(canTransitionMemoryStatus('Canon', 'Candidate')).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- packages/domain/src/shared`

Expected: FAIL because the exported helpers do not exist.

- [ ] **Step 4: Build minimal domain helpers**

```typescript
export type EntityPrefix =
  | 'project'
  | 'volume'
  | 'chapter'
  | 'scene'
  | 'artifact'
  | 'agent_run'
  | 'context_pack'
  | 'canon_fact'
  | 'reader_promise';

export type EntityId<TPrefix extends EntityPrefix = EntityPrefix> = `${TPrefix}_${string}`;

export function createId<TPrefix extends EntityPrefix>(prefix: TPrefix): EntityId<TPrefix> {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}` as EntityId<TPrefix>;
}
```

```typescript
export type MemoryStatus = 'Candidate' | 'Draft' | 'Canon' | 'Deprecated' | 'Conflict';

const allowedTransitions: ReadonlySet<string> = new Set([
  'Candidate->Draft',
  'Draft->Canon',
  'Canon->Deprecated',
  'Canon->Conflict',
  'Conflict->Canon',
  'Conflict->Deprecated',
  'Conflict->Draft'
]);

export function canTransitionMemoryStatus(from: MemoryStatus, to: MemoryStatus): boolean {
  return allowedTransitions.has(`${from}->${to}`);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- packages/domain/src/shared`

Expected: PASS with domain shared tests.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src
git commit -m "feat: add domain core primitives"
```

## Task 3: Project and Manuscript Domain

**Files:**

- Create: `packages/domain/src/project/project.ts`
- Create: `packages/domain/src/project/manuscript.ts`
- Test: `packages/domain/src/project/project.test.ts`
- Test: `packages/domain/src/project/manuscript.test.ts`

- [ ] **Step 1: Write failing project test**

```typescript
import { describe, expect, it } from 'vitest';
import { createProject } from './project';

describe('createProject', () => {
  it('creates a local-first novel project with reader contract defaults', () => {
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });

    expect(project.title).toBe('Long Night');
    expect(project.readerContract.targetAudience).toBe('Chinese web-novel readers');
    expect(project.status).toBe('Active');
  });
});
```

- [ ] **Step 2: Write failing manuscript test**

```typescript
import { describe, expect, it } from 'vitest';
import { addChapterToVolume, createVolume } from './manuscript';

describe('manuscript structure', () => {
  it('keeps chapter order stable inside a volume', () => {
    const volume = createVolume({ projectId: 'project_abc', title: 'Volume One', order: 1 });
    const withFirst = addChapterToVolume(volume, { title: 'Chapter 1', order: 1 });
    const withSecond = addChapterToVolume(withFirst, { title: 'Chapter 2', order: 2 });

    expect(withSecond.chapters.map((chapter) => chapter.title)).toEqual(['Chapter 1', 'Chapter 2']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- packages/domain/src/project`

Expected: FAIL because project and manuscript factories do not exist.

- [ ] **Step 4: Build minimal domain factories**

```typescript
import { createId, type EntityId } from '../shared/ids';

export type ProjectStatus = 'Active' | 'Archived';

export interface ReaderContract {
  targetAudience: string;
  genrePromise: string;
  forbiddenDirections: string[];
}

export interface Project {
  id: EntityId<'project'>;
  title: string;
  language: 'zh-CN' | 'en-US';
  status: ProjectStatus;
  readerContract: ReaderContract;
  createdAt: string;
  updatedAt: string;
}

export function createProject(input: {
  title: string;
  language: 'zh-CN' | 'en-US';
  targetAudience: string;
  genrePromise?: string;
}): Project {
  const now = new Date().toISOString();
  return {
    id: createId('project'),
    title: input.title,
    language: input.language,
    status: 'Active',
    readerContract: {
      targetAudience: input.targetAudience,
      genrePromise: input.genrePromise ?? 'Sustained long-form reader satisfaction',
      forbiddenDirections: []
    },
    createdAt: now,
    updatedAt: now
  };
}
```

```typescript
import { createId, type EntityId } from '../shared/ids';

export interface Chapter {
  id: EntityId<'chapter'>;
  projectId: EntityId<'project'>;
  volumeId: EntityId<'volume'>;
  title: string;
  order: number;
  status: 'Draft' | 'Review' | 'Ready' | 'Published';
}

export interface Volume {
  id: EntityId<'volume'>;
  projectId: EntityId<'project'>;
  title: string;
  order: number;
  chapters: Chapter[];
}

export function createVolume(input: {
  projectId: EntityId<'project'>;
  title: string;
  order: number;
}): Volume {
  return {
    id: createId('volume'),
    projectId: input.projectId,
    title: input.title,
    order: input.order,
    chapters: []
  };
}

export function addChapterToVolume(volume: Volume, input: { title: string; order: number }): Volume {
  const chapter: Chapter = {
    id: createId('chapter'),
    projectId: volume.projectId,
    volumeId: volume.id,
    title: input.title,
    order: input.order,
    status: 'Draft'
  };
  return {
    ...volume,
    chapters: [...volume.chapters, chapter].sort((left, right) => left.order - right.order)
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- packages/domain/src/project`

Expected: PASS with project and manuscript tests.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/project
git commit -m "feat: model projects and manuscripts"
```

## Task 4: Artifact, AgentRun, ContextPack, and LLM Gateway Contracts

**Files:**

- Create: `packages/domain/src/artifact/artifact.ts`
- Create: `packages/domain/src/agents/agent-run.ts`
- Create: `packages/domain/src/agents/context-pack.ts`
- Create: `packages/domain/src/agents/llm-gateway.ts`
- Test: `packages/domain/src/artifact/artifact.test.ts`
- Test: `packages/domain/src/agents/agent-run.test.ts`
- Test: `packages/domain/src/agents/context-pack.test.ts`
- Test: `packages/domain/src/agents/llm-gateway.test.ts`

- [ ] **Step 1: Write failing artifact test**

```typescript
import { describe, expect, it } from 'vitest';
import { createArtifactRecord } from './artifact';

describe('createArtifactRecord', () => {
  it('requires hash, type, source, and version metadata', () => {
    const artifact = createArtifactRecord({
      type: 'context_pack',
      source: 'agent_run',
      version: 1,
      hash: 'sha256:abc',
      uri: 'artifacts/context-pack.json'
    });

    expect(artifact.hash).toBe('sha256:abc');
    expect(artifact.version).toBe(1);
  });
});
```

- [ ] **Step 2: Write failing agent and context tests**

```typescript
import { describe, expect, it } from 'vitest';
import { createAgentRun } from './agent-run';

describe('createAgentRun', () => {
  it('records prompt version and traceable context pack id', () => {
    const run = createAgentRun({
      agentName: 'Planner Agent',
      taskType: 'chapter_planning',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_v1',
      contextPackId: 'context_pack_abc'
    });

    expect(run.status).toBe('Queued');
    expect(run.promptVersionId).toBe('prompt_v1');
    expect(run.contextPackId).toBe('context_pack_abc');
  });
});
```

```typescript
import { describe, expect, it } from 'vitest';
import { createContextPack } from './context-pack';

describe('createContextPack', () => {
  it('stores citations, warnings, exclusions, and retrieval trace', () => {
    const pack = createContextPack({
      taskGoal: 'Draft a scene',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'Hero is injured.' }],
      citations: [{ sourceId: 'canon_fact_1', quote: 'Hero is injured.' }],
      exclusions: ['restricted_sample_1'],
      warnings: ['Timeline deadline nearby'],
      retrievalTrace: ['keyword: hero injury']
    });

    expect(pack.exclusions).toContain('restricted_sample_1');
    expect(pack.citations).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Write failing gateway test**

```typescript
import { describe, expect, it } from 'vitest';
import type { ProviderAdapter } from './llm-gateway';

describe('ProviderAdapter contract', () => {
  it('supports text, structured output, streaming, embeddings, and cost estimation', async () => {
    const adapter: ProviderAdapter = {
      generateText: async () => ({ text: 'draft', usage: { inputTokens: 1, outputTokens: 1 } }),
      generateStructured: async () => ({ value: { title: 'Chapter' }, usage: { inputTokens: 1, outputTokens: 1 } }),
      streamText: async function* () {
        yield 'draft';
      },
      embedText: async () => ({ vector: [0.1, 0.2], model: 'fake-embedding' }),
      estimateCost: () => ({ estimatedUsd: 0.01 })
    };

    await expect(adapter.generateText({ prompt: 'x' })).resolves.toMatchObject({ text: 'draft' });
    await expect(adapter.embedText({ text: 'x' })).resolves.toMatchObject({ model: 'fake-embedding' });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- packages/domain/src/artifact packages/domain/src/agents`

Expected: FAIL because contracts do not exist.

- [ ] **Step 5: Build minimal contracts**

```typescript
export type ArtifactType = 'manuscript_version' | 'context_pack' | 'agent_output' | 'review_report' | 'import_raw';
export type ArtifactSource = 'user' | 'agent_run' | 'import' | 'system';

export interface ArtifactRecord {
  id: string;
  type: ArtifactType;
  source: ArtifactSource;
  version: number;
  hash: string;
  uri: string;
  createdAt: string;
}

export function createArtifactRecord(input: Omit<ArtifactRecord, 'id' | 'createdAt'>): ArtifactRecord {
  return {
    id: `artifact_${crypto.randomUUID().replace(/-/g, '')}`,
    createdAt: new Date().toISOString(),
    ...input
  };
}
```

```typescript
export type AgentRunStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Cancelled';

export interface AgentRun {
  id: string;
  agentName: string;
  taskType: string;
  workflowType: string;
  promptVersionId: string;
  contextPackId: string;
  status: AgentRunStatus;
  createdAt: string;
}

export function createAgentRun(input: Omit<AgentRun, 'id' | 'status' | 'createdAt'>): AgentRun {
  return {
    id: `agent_run_${crypto.randomUUID().replace(/-/g, '')}`,
    status: 'Queued',
    createdAt: new Date().toISOString(),
    ...input
  };
}
```

```typescript
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Blocking';

export interface ContextCitation {
  sourceId: string;
  quote: string;
}

export interface ContextPack {
  id: string;
  taskGoal: string;
  agentRole: string;
  riskLevel: RiskLevel;
  sections: Array<{ name: string; content: string }>;
  citations: ContextCitation[];
  exclusions: string[];
  warnings: string[];
  retrievalTrace: string[];
  createdAt: string;
}

export function createContextPack(input: Omit<ContextPack, 'id' | 'createdAt'>): ContextPack {
  return {
    id: `context_pack_${crypto.randomUUID().replace(/-/g, '')}`,
    createdAt: new Date().toISOString(),
    ...input
  };
}
```

```typescript
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderAdapter {
  generateText(input: { prompt: string; model?: string }): Promise<{ text: string; usage: TokenUsage }>;
  generateStructured<T>(input: { prompt: string; schemaName: string; model?: string }): Promise<{ value: T; usage: TokenUsage }>;
  streamText(input: { prompt: string; model?: string }): AsyncIterable<string>;
  embedText(input: { text: string; model?: string }): Promise<{ vector: number[]; model: string }>;
  estimateCost(input: { model?: string; inputTokens: number; outputTokens: number }): { estimatedUsd: number };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- packages/domain/src/artifact packages/domain/src/agents`

Expected: PASS with artifact and agent contract tests.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/artifact packages/domain/src/agents
git commit -m "feat: define artifacts and agent run contracts"
```

## Task 5: Drizzle and SQLite Persistence Foundation

**Files:**

- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/connection.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/repositories/project.repository.ts`
- Create: `packages/db/src/repositories/manuscript.repository.ts`
- Create: `packages/db/src/repositories/artifact.repository.ts`
- Create: `packages/db/src/repositories/agent-run.repository.ts`
- Create: `packages/db/src/repositories/context-pack.repository.ts`
- Create: `packages/db/src/test/database.test.ts`
- Create: `packages/db/src/test/project.repository.test.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Write failing database test**

```typescript
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';

describe('createDatabase', () => {
  it('opens SQLite with WAL enabled', () => {
    const database = createDatabase(':memory:');
    const journalMode = database.raw.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(journalMode.journal_mode.toLowerCase()).toBe('wal');
  });
});
```

- [ ] **Step 2: Write failing repository test**

```typescript
import { describe, expect, it } from 'vitest';
import { createProject } from '@ai-novel/domain';
import { createDatabase } from '../connection';
import { ProjectRepository } from '../repositories/project.repository';

describe('ProjectRepository', () => {
  it('saves and loads a project by id', async () => {
    const database = createDatabase(':memory:');
    const repository = new ProjectRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });

    await repository.save(project);
    await expect(repository.findById(project.id)).resolves.toMatchObject({
      id: project.id,
      title: 'Long Night'
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- packages/db/src/test`

Expected: FAIL because `@ai-novel/db` package and schema do not exist.

- [ ] **Step 4: Build minimal schema and repository**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createDatabase(filename: string) {
  const raw = new Database(filename);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  const db = drizzle(raw, { schema });
  return { raw, db };
}
```

```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  language: text('language').notNull(),
  status: text('status').notNull(),
  readerContractJson: text('reader_contract_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
});
```

```typescript
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Project } from '@ai-novel/domain';
import { projects } from '../schema';

export class ProjectRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  async save(project: Project): Promise<void> {
    await this.db.insert(projects).values({
      id: project.id,
      title: project.title,
      language: project.language,
      status: project.status,
      readerContractJson: JSON.stringify(project.readerContract),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    });
  }

  async findById(id: string): Promise<Project | null> {
    const row = await this.db.select().from(projects).where(eq(projects.id, id)).get();
    if (!row) return null;
    return {
      id: row.id as Project['id'],
      title: row.title,
      language: row.language as Project['language'],
      status: row.status as Project['status'],
      readerContract: JSON.parse(row.readerContractJson) as Project['readerContract'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- packages/db/src/test`

Expected: PASS with database and project repository tests.

- [ ] **Step 6: Commit**

```bash
git add packages/db drizzle.config.ts package.json package-lock.json
git commit -m "feat: add SQLite persistence foundation"
```

## Task 6: Node API Foundation

**Files:**

- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.routes.ts`
- Create: `apps/api/src/routes/projects.routes.ts`
- Create: `apps/api/src/services/project.service.ts`
- Test: `apps/api/src/test/app.test.ts`

- [ ] **Step 1: Write failing API test**

```typescript
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('API app', () => {
  it('reports health', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: 'ai-novel-api' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/api/src/test/app.test.ts`

Expected: FAIL because `buildApp` does not exist.

- [ ] **Step 3: Build minimal Fastify app**

```typescript
import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({
    ok: true,
    service: 'ai-novel-api'
  }));

  return app;
}
```

```typescript
import { buildApp } from './app';

const app = buildApp();
await app.listen({ host: '127.0.0.1', port: Number(process.env.PORT ?? 4000) });
```

- [ ] **Step 4: Add project route test**

```typescript
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('project routes', () => {
  it('creates a project through the API', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Long Night',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ title: 'Long Night', status: 'Active' });
  });
});
```

- [ ] **Step 5: Build minimal project route**

```typescript
import { createProject } from '@ai-novel/domain';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';

const createProjectSchema = z.object({
  title: z.string().min(1),
  language: z.enum(['zh-CN', 'en-US']),
  targetAudience: z.string().min(1)
});

export function registerProjectRoutes(app: FastifyInstance) {
  app.post('/projects', async (request, reply) => {
    const input = createProjectSchema.parse(request.body);
    const project = createProject(input);
    return reply.code(201).send(project);
  });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- apps/api/src/test`

Expected: PASS with health and project route tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat: add Node API foundation"
```

## Task 7: React/Vite Workspace Shell

**Files:**

- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/ProjectDashboard.tsx`
- Create: `apps/web/src/components/DecisionQueuePanel.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/styles.css`
- Test: `apps/web/src/test/App.test.tsx`
- Test: `tests/e2e/workspace.spec.ts`

- [ ] **Step 1: Write failing component test**

```typescript
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

describe('App', () => {
  it('renders the writing cockpit dashboard', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'AI Novel Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Decision Queue')).toBeInTheDocument();
    expect(screen.getByText('Current Project')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/src/test/App.test.tsx`

Expected: FAIL because the React app does not exist.

- [ ] **Step 3: Build the shell**

```tsx
export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>AI Novel Workspace</h1>
        <nav aria-label="Primary">
          <a href="#dashboard">Dashboard</a>
          <a href="#manuscript">Manuscript</a>
          <a href="#story-bible">Story Bible</a>
          <a href="#agent-room">Agent Room</a>
        </nav>
      </aside>
      <section className="workspace" id="dashboard">
        <header>
          <p>Current Project</p>
          <h2>Writing Cockpit</h2>
        </header>
        <section className="status-grid">
          <article>
            <h3>Manuscript</h3>
            <p>No chapters yet.</p>
          </article>
          <article>
            <h3>Reader Promises</h3>
            <p>No active promises yet.</p>
          </article>
          <article>
            <h3>Decision Queue</h3>
            <p>No blocking decisions.</p>
          </article>
        </section>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add Playwright smoke test**

```typescript
import { expect, test } from '@playwright/test';

test('workspace dashboard loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'AI Novel Workspace' })).toBeVisible();
  await expect(page.getByText('Decision Queue')).toBeVisible();
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- apps/web/src/test/App.test.tsx`

Expected: PASS with the app shell test.

- [ ] **Step 6: Run browser check**

Run: `npm run dev:web`

Expected: Vite serves the app. Then run `npm run test:e2e` with the configured Vite web server.

- [ ] **Step 7: Commit**

```bash
git add apps/web tests/e2e playwright.config.ts
git commit -m "feat: add React writing workspace shell"
```

## Task 8: Phase 1 Verification and Push

**Files:**

- Modify only files created in Tasks 1-7.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all Vitest tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: all workspace builds pass.

- [ ] **Step 3: Run database check**

Run: `npm run db:check`

Expected: SQLite opens with WAL and foreign keys enabled.

- [ ] **Step 4: Run Playwright**

Run: `npm run test:e2e`

Expected: workspace dashboard smoke test passes.

- [ ] **Step 5: Commit verification fixes if any were needed**

```bash
git add .
git commit -m "test: verify foundation phase"
```

If there are no changes after verification, skip this commit.

- [ ] **Step 6: Push branch**

```bash
git push -u origin feature/ai-novel-agent-system
```

Expected: branch is pushed to remote.

## Phase 2 Task Map: Memory and Retrieval

### Task 9: Canon Ledger and Approval Requests

**Files:**

- Create: `packages/domain/src/memory/canon.ts`
- Create: `packages/domain/src/memory/approvals.ts`
- Test: `packages/domain/src/memory/canon.test.ts`
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/src/repositories/memory.repository.ts`
- Test: `packages/db/src/test/memory.repository.test.ts`

- [ ] Write a failing test that `createCanonFact` rejects Canon status without a source and confirmation trail.
- [ ] Write a failing test that `transitionCanonFactStatus` allows Candidate to Draft, Draft to Canon, Canon to Deprecated, Canon to Conflict, Conflict to Canon, Conflict to Deprecated, and Conflict to Draft.
- [ ] Build CanonFact, CanonLedgerEntry, MemoryDecision, ConflictRecord, ApprovalRequest, SourceReference, Scope, DataQualityIssue, and allowed transition helpers.
- [ ] Persist canon facts, ledger entries, approvals, conflicts, and data-quality issues with Drizzle tables.
- [ ] Verify with `npm test -- packages/domain/src/memory packages/db/src/test/memory.repository.test.ts`.
- [ ] Commit with `git commit -m "feat: add canon memory governance"`.

### Task 10: Retrieval Policy, FTS, Vector Adapter, and Context Builder

**Files:**

- Create: `packages/retrieval/src/retrieval-policy.ts`
- Create: `packages/retrieval/src/keyword-search.ts`
- Create: `packages/retrieval/src/vector-store.ts`
- Create: `packages/retrieval/src/context-builder.ts`
- Test: `packages/retrieval/src/context-builder.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that a context pack retrieves Canon over Draft for the same entity.
- [ ] Write a failing test that restricted SourcePolicy records are excluded from generation context and listed in exclusions.
- [ ] Build RetrievalPlan, KeywordSearchAdapter, VectorStoreAdapter, RetrievalTrace, ContextCitation, and ContextBuilder.
- [ ] Add SQLite FTS tables for manuscript text, canon text, knowledge summaries, review findings, and reader feedback.
- [ ] Verify with `npm test -- packages/retrieval packages/domain/src/agents/context-pack.test.ts`.
- [ ] Commit with `git commit -m "feat: build retrieval and context builder foundation"`.

### Task 11: Narrative Dependency Index

**Files:**

- Create: `packages/domain/src/narrative/dependencies.ts`
- Test: `packages/domain/src/narrative/dependencies.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that links a chapter to a canon fact with dependency type, confidence, source run, and invalidation rule.
- [ ] Build DependencyIndexEntry, DependencyInvalidation, and dependency query helpers.
- [ ] Persist dependencies and invalidations.
- [ ] Verify with `npm test -- packages/domain/src/narrative/dependencies.test.ts packages/db/src/test`.
- [ ] Commit with `git commit -m "feat: add narrative dependency index"`.

## Phase 3 Task Map: Advanced Narrative Systems

### Task 12: Foreshadowing and Reader Promise System

**Files:**

- Create: `packages/domain/src/narrative/promises.ts`
- Test: `packages/domain/src/narrative/promises.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that a Core reader promise enters the decision queue when detected from an agent run.
- [ ] Write a failing test that promise health becomes Ready for payoff when current chapter range, related entities, and payoff window match.
- [ ] Build Foreshadowing, ForeshadowingCandidate, ReaderPromise, PromiseHealthAssessment, PayoffPlan, PayoffReview, UI state mapping, and user actions.
- [ ] Persist promise records, candidate pools, health assessments, and payoff reviews.
- [ ] Verify with `npm test -- packages/domain/src/narrative/promises.test.ts`.
- [ ] Commit with `git commit -m "feat: add reader promise governance"`.

### Task 13: Secrets, Knowledge Boundaries, and Reveals

**Files:**

- Create: `packages/domain/src/narrative/secrets.ts`
- Test: `packages/domain/src/narrative/secrets.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that a character cannot use a secret before its KnowledgeState says they know it.
- [ ] Write a failing test that reveal events update reader and character knowledge separately.
- [ ] Build Secret, KnowledgeState, RevealPlan, RevealEvent, Misinformation, and leak detection helpers.
- [ ] Verify with `npm test -- packages/domain/src/narrative/secrets.test.ts`.
- [ ] Commit with `git commit -m "feat: add secret and reveal tracking"`.

### Task 14: Character Arc and Relationship Systems

**Files:**

- Create: `packages/domain/src/narrative/arcs.ts`
- Test: `packages/domain/src/narrative/arcs.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that a relationship state cannot jump from Hostile to Loyal without a turning point.
- [ ] Write a failing test that a motivation state records current goal, pressure, belief challenge, and source.
- [ ] Build CharacterArc, MotivationState, BeliefState, RelationshipArc, RelationshipTurningPoint, and earned-transition checks.
- [ ] Verify with `npm test -- packages/domain/src/narrative/arcs.test.ts`.
- [ ] Commit with `git commit -m "feat: track character arcs and relationships"`.

### Task 15: Timeline, Location, and Causality

**Files:**

- Create: `packages/domain/src/narrative/timeline.ts`
- Test: `packages/domain/src/narrative/timeline.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that a causal link is invalid when the effect occurs before the cause.
- [ ] Write a failing test that a character cannot appear in two distant locations without enough travel duration.
- [ ] Build TimelineEvent, DurationConstraint, LocationState, CausalLink, Deadline, ConcurrentEvent, and timeline validation.
- [ ] Verify with `npm test -- packages/domain/src/narrative/timeline.test.ts`.
- [ ] Commit with `git commit -m "feat: validate timeline and causality"`.

### Task 16: World Rules, Powers, and Constraints

**Files:**

- Create: `packages/domain/src/narrative/rules.ts`
- Test: `packages/domain/src/narrative/rules.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that a power use fails when the required cost is missing.
- [ ] Write a failing test that a new rule exception creates a high-risk approval request.
- [ ] Build WorldRule, PowerSystemRule, RuleConstraint, RuleException, AbilityCost, AbilityLimit, and rule-check helpers.
- [ ] Verify with `npm test -- packages/domain/src/narrative/rules.test.ts`.
- [ ] Commit with `git commit -m "feat: enforce world rules and power constraints"`.

### Task 17: Change Impact, Retcon, Regression, Branch, and Closure

**Files:**

- Create: `packages/domain/src/narrative/impact.ts`
- Create: `packages/domain/src/narrative/branches.ts`
- Create: `packages/domain/src/narrative/closure.ts`
- Test: `packages/domain/src/narrative/impact.test.ts`
- Test: `packages/domain/src/narrative/branches.test.ts`
- Test: `packages/domain/src/narrative/closure.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing impact test that changing a canon fact returns affected chapters, promises, secrets, arcs, rules, and timeline events from dependencies.
- [ ] Write a failing branch test that BranchScenario artifacts do not alter canon until adoption.
- [ ] Write a failing closure test that unresolved Core promises and major character arcs appear in a closure checklist.
- [ ] Build ImpactReport, RetconPlan, RegressionCheck, BranchScenario, BranchDiff, ScenarioProjection, ClosureChecklist, FinalArcPlan, and ClosureItem.
- [ ] Verify with `npm test -- packages/domain/src/narrative/impact.test.ts packages/domain/src/narrative/branches.test.ts packages/domain/src/narrative/closure.test.ts`.
- [ ] Commit with `git commit -m "feat: add impact branch and closure systems"`.

## Phase 4 Task Map: Agent Workflows and Runtime

### Task 18: Task Contracts, Durable Jobs, and Run Graph

**Files:**

- Create: `packages/workflow/src/task-contract.ts`
- Create: `packages/workflow/src/durable-job.ts`
- Create: `packages/workflow/src/workflow-runner.ts`
- Test: `packages/workflow/src/workflow-runner.test.ts`
- Modify: `packages/db/src/schema.ts`

- [ ] Write a failing test that a workflow run records ordered run steps, intermediate artifacts, retry attempts, and failure records.
- [ ] Write a failing test that a job can be paused, resumed, cancelled, retried, and replayed.
- [ ] Build TaskContract, WorkflowDefinition, RunStep, durable job records, and workflow runner.
- [ ] Verify with `npm test -- packages/workflow`.
- [ ] Commit with `git commit -m "feat: add workflow and durable job runtime"`.

### Task 19: Creative Copilot Runtime and Authorship Control

**Files:**

- Create: `packages/workflow/src/copilot-runtime.ts`
- Create: `packages/workflow/src/authorship.ts`
- Test: `packages/workflow/src/copilot-runtime.test.ts`
- Test: `packages/workflow/src/authorship.test.ts`

- [ ] Write a failing test that high-risk canon conflict becomes visible even in quiet initiative mode.
- [ ] Write a failing test that A1-A4 authorship requests create a WritingContract before draft generation.
- [ ] Write a failing test that agent-authored prose remains a draft artifact until user acceptance.
- [ ] Build CopilotRuntimePolicy, AuthorshipSession, WritingContract, risk gates, visibility rules, and acceptance decisions.
- [ ] Verify with `npm test -- packages/workflow/src/copilot-runtime.test.ts packages/workflow/src/authorship.test.ts`.
- [ ] Commit with `git commit -m "feat: add creative copilot and authorship controls"`.

### Task 20: LLM Gateway Providers and Agent Roles

**Files:**

- Modify: `packages/llm-gateway/src/gateway.ts`
- Modify: `packages/llm-gateway/src/fake-provider.ts`
- Modify: `packages/llm-gateway/src/openai-provider.ts`
- Test: `packages/llm-gateway/src/gateway.test.ts`
- Create: `packages/workflow/src/agents.ts`
- Test: `packages/workflow/src/agents.test.ts`

- [ ] Write a failing gateway test that structured generation rejects invalid schema output and records a repair attempt.
- [ ] Write a failing gateway test that every model call logs prompt version, provider, model, usage, duration, and estimated cost.
- [ ] Write a failing agent test that Chief Editor, Planner, Lore Keeper, Writer, Editor, Continuity Sentinel, Voice Director, Research, Market Analyst, Serialization, and Memory Curator produce typed artifact contracts.
- [ ] Build gateway routing, fake deterministic provider, OpenAI provider boundary, schema validation, retry and repair metadata, and agent definitions.
- [ ] Verify with `npm test -- packages/llm-gateway packages/workflow/src/agents.test.ts`.
- [ ] Commit with `git commit -m "feat: add llm gateway and agent definitions"`.

## Phase 5 Task Map: Workbench, Review, Revision, and Serialization

### Task 21: Manuscript Editor and Story Bible Boards

**Files:**

- Create: `apps/web/src/components/ManuscriptEditor.tsx`
- Create: `apps/web/src/components/StoryBible.tsx`
- Create: `apps/web/src/components/PromiseBoard.tsx`
- Create: `apps/web/src/components/SecretBoard.tsx`
- Create: `apps/web/src/components/ArcBoard.tsx`
- Create: `apps/web/src/components/TimelineMap.tsx`
- Create: `apps/web/src/components/WorldRuleMap.tsx`
- Test: `apps/web/src/test/workbench.test.tsx`

- [ ] Write failing component tests for chapter tree, editor surface, promise board states, secret reveal status, arc state, timeline warning, and world-rule warning.
- [ ] Build the UI with compact operational layouts and no marketing surface.
- [ ] Verify with `npm test -- apps/web/src/test/workbench.test.tsx`.
- [ ] Commit with `git commit -m "feat: add writing workbench boards"`.

### Task 22: Review Center and Revision Diff Flow

**Files:**

- Create: `packages/domain/src/review/review.ts`
- Test: `packages/domain/src/review/review.test.ts`
- Create: `apps/web/src/components/ReviewCenter.tsx`
- Create: `apps/web/src/components/RevisionDiff.tsx`
- Test: `apps/web/src/test/review-center.test.tsx`

- [ ] Write a failing domain test that ReviewFinding targets a specific manuscript version and includes category, severity, evidence citations, impact, fix options, auto-fix risk, and status.
- [ ] Write a failing UI test that a finding can be applied, rejected, explained, or converted to a task.
- [ ] Build ReviewReport, ReviewFinding, RevisionSuggestion, QualityScore, ReviewProfile, FalsePositiveRecord, and diff presentation.
- [ ] Verify with `npm test -- packages/domain/src/review apps/web/src/test/review-center.test.tsx`.
- [ ] Commit with `git commit -m "feat: add review and revision workflow"`.

### Task 23: Serialization Desk

**Files:**

- Create: `packages/domain/src/serialization/serialization.ts`
- Test: `packages/domain/src/serialization/serialization.test.ts`
- Create: `apps/web/src/components/SerializationDesk.tsx`
- Test: `apps/web/src/test/serialization-desk.test.tsx`

- [ ] Write a failing domain test that publish readiness blocks on high-risk reader-promise, reveal, source-policy, and update-calendar issues.
- [ ] Write a failing UI test that reader feedback import updates feedback summary without overriding long-term plan.
- [ ] Build SerializationPlan, PublishChecklist, UpdateSchedule, ReaderFeedback, ReaderFeedbackSummary, ReaderSegment, PlatformProfile, and SerializationExperiment.
- [ ] Verify with `npm test -- packages/domain/src/serialization apps/web/src/test/serialization-desk.test.tsx`.
- [ ] Commit with `git commit -m "feat: add serialization desk"`.

## Phase 6 Task Map: Knowledge, Import/Export, Evaluation, Observability

### Task 24: Knowledge Library and SourcePolicy

**Files:**

- Create: `packages/domain/src/knowledge/knowledge.ts`
- Test: `packages/domain/src/knowledge/knowledge.test.ts`
- Create: `apps/web/src/components/KnowledgeLibrary.tsx`
- Test: `apps/web/src/test/knowledge-library.test.tsx`

- [ ] Write a failing SourcePolicy test that restricted samples are allowed for analysis but blocked from generation support.
- [ ] Write a failing knowledge lifecycle test that ingested material records source type, allowed use, prohibited use, attribution requirements, license notes, and similarity risk.
- [ ] Build KnowledgeItem, IdeaItem, QuickCapture, Material, Sample, Trope, Technique, GenreRule, ScenePattern, CharacterTemplate, WorldTemplate, StyleProfile, ReviewRule, SourcePolicy, EmbeddingRecord, Tag, AntiPattern, and StyleExperiment.
- [ ] Verify with `npm test -- packages/domain/src/knowledge apps/web/src/test/knowledge-library.test.tsx`.
- [ ] Commit with `git commit -m "feat: add knowledge library and source policies"`.

### Task 25: Import, Export, Backup, and Restore

**Files:**

- Create: `packages/domain/src/import-export/import-export.ts`
- Test: `packages/domain/src/import-export/import-export.test.ts`
- Create: `packages/workflow/src/import-workflow.ts`
- Create: `packages/workflow/src/export-workflow.ts`
- Test: `packages/workflow/src/import-export.test.ts`

- [ ] Write a failing import test that txt, markdown, docx metadata, pasted chapters, character sheets, user notes, and sample entries create ImportBatch records and raw file artifacts.
- [ ] Write a failing export test that a project bundle includes project metadata, chapters, artifacts, canon, knowledge items, source policies, run logs, and settings snapshot.
- [ ] Write a failing restore test that the bundle round-trips into a new SQLite database with matching hashes.
- [ ] Build ImportBatch, parsers behind adapters, ProjectBundle, backup writer, restore reader, rollback records, and migration boundary.
- [ ] Verify with `npm test -- packages/domain/src/import-export packages/workflow/src/import-export.test.ts`.
- [ ] Commit with `git commit -m "feat: add import export and backup workflows"`.

### Task 26: Evaluation and Observability

**Files:**

- Create: `packages/evaluation/src/evaluation-case.ts`
- Create: `packages/evaluation/src/evaluation-runner.ts`
- Create: `packages/evaluation/src/observability.ts`
- Test: `packages/evaluation/src/evaluation-runner.test.ts`
- Create: `apps/web/src/components/ObservabilityDashboard.tsx`
- Test: `apps/web/src/test/observability-dashboard.test.tsx`

- [ ] Write a failing evaluation test that a retrieval policy change runs against saved project queries and reports missing must-have facts.
- [ ] Write a failing observability test that AgentRun metrics include cost, tokens, duration, failure rate, retry count, context length, model usage, quality outcome, and user adoption.
- [ ] Build RunError, EvaluationCase, EvaluationResult, cost telemetry, model usage summaries, workflow bottleneck reports, data-quality dashboard, and evaluation runner.
- [ ] Verify with `npm test -- packages/evaluation apps/web/src/test/observability-dashboard.test.tsx`.
- [ ] Commit with `git commit -m "feat: add evaluation and observability"`.

## Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run db:check`.
- [ ] Run `npm run test:e2e`.
- [ ] Open the web app in the browser and inspect desktop and mobile layouts for text overlap.
- [ ] Confirm all high-risk workflows route to approval requests or decision queue.
- [ ] Confirm agent-written prose cannot become accepted manuscript text without user acceptance.
- [ ] Confirm restricted SourcePolicy content is excluded from generation context.
- [ ] Confirm branch scenario outputs remain isolated until adoption.
- [ ] Confirm project bundle backup and restore preserve hashes.
- [ ] Commit final verification changes when present.
- [ ] Push the branch.

## Self-Review Checklist

- Spec coverage: every design subsystem maps to a phase and task in this plan.
- Placeholder scan: this document avoids unfinished-marker language and unspecified catch-all tasks.
- Type consistency: Project, Manuscript, Artifact, AgentRun, ContextPack, LLM Gateway, Canon, Retrieval, and narrative system names are stable across tasks.
- TDD consistency: each implementation task starts with failing tests and verification commands.
- Commit cadence: Phase 1 has task-level commits; later phases have subsystem commits and phase-gate pushes.
