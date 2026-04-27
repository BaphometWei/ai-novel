# AI Novel Agent V2 Production Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current V1 skeleton on `main` into a usable local writing product with real provider wiring, persistent API-backed workflows, editor acceptance flows, Agent Room inspection, memory/canon/retrieval workflows, settings, import/export/backup UI, search, and verified browser paths.

**Architecture:** Keep the modular monolith from the full system design: React/Vite/TypeScript web app, Node/TypeScript Fastify API, pure domain packages, Drizzle repositories, SQLite WAL, artifact storage, provider-agnostic LLM gateway, retrieval/context builder, durable workflow runtime, and evaluation/observability. V2 hardens and connects existing V1 modules rather than replacing the stack or expanding product boundaries.

**Tech Stack:** React, Vite, TypeScript, Node.js, Fastify, Zod, Drizzle ORM, SQLite, Vitest, Playwright, TipTap or equivalent editor integration, npm workspaces.

---

## Baseline

Confirmed before writing this plan:

- Current workspace: `E:\repo\ai-novel`.
- Current branch before planning: `main`, then planning branch `codex/v2-v3-implementation`.
- Current HEAD before planning: `c6635aa Merge feature/ai-novel-agent-system`.
- `main...origin/main` was clean before creating this plan.
- Existing remote is `git@github.com:BaphometWei/ai-novel.git`; user provided `git@github.com-baphometwei:BaphometWei/ai-novel.git`. Use existing `origin` first and record any push authentication issue.
- `node_modules` is not present, so V2 implementation begins with `npm install` as an environment preparation step.
- V1 already contains React/Vite/TypeScript frontend, Fastify API, Drizzle/SQLite, domain modules, project/manuscript, artifacts, agent runs, context packs, LLM gateway contracts, memory/canon/retrieval basics, narrative domain helpers, workflow runtime, review/revision, serialization, knowledge/source policy, import/export/backup, evaluation, and observability.

## Design Anchors

This plan is derived from `docs/superpowers/specs/2026-04-26-ai-novel-agent-full-system-design.md`:

- Purpose and product boundary: lines 5-34.
- Main Workspace: lines 101-132.
- Domain model: lines 134-356.
- Storage rules: lines 357-381.
- Memory system: lines 383-430.
- Creative Copilot Runtime and authorship control: lines 840-952.
- Agent operating system and workflows: lines 954-1057.
- Retrieval and Context Builder: lines 1058-1126.
- Knowledge, sample, and style library: lines 1127-1174.
- Review and Revision: lines 1175-1254.
- Serialization: lines 1255-1295.
- Technical architecture and LLM Gateway: lines 1297-1369.
- Durable jobs and observability: lines 1371-1406.
- Import, export, and backup: lines 1408-1449.
- Safety and rights: lines 1451-1462.
- Implementation defaults and acceptance criteria: lines 1545-1583.

## Goals

- Wire a real OpenAI-compatible provider adapter behind the existing LLM Gateway while keeping fake provider tests deterministic.
- Enforce local env/secrets boundaries: API keys stay in local environment or local settings storage, never in ordinary logs or artifacts.
- Add prompt version registry, streaming contract, model routing, call logging, cost estimates, and budget guards.
- Replace static demo UI data with API-backed flows for projects, manuscripts, chapters, artifacts, agent runs, context packs, review, knowledge, serialization, import/export/backup, settings, search, and approvals.
- Add Project / Manuscript / Chapter CRUD and version management across API, DB, domain, and UI.
- Integrate TipTap or an equivalent editor behind a stable editor component interface.
- Implement the usable writing flow: select target, create WritingContract, build ContextPack through retrieval, run Writer and Reviewer agents, create draft artifact, review, accept/reject, and write accepted text as a manuscript version.
- Add Agent Room for runs, context packs, run graph, artifacts, approvals, cost, errors, and replay/cancel/retry state.
- Add memory extraction from accepted text and route high-risk changes into decision queue.
- Make Canon / Retrieval usable from UI and API with citations, exclusions, warnings, search, and source-policy handling.
- Add Import / Export / Backup / Restore UI over existing workflow/domain modules.
- Add Settings for providers, budgets, source policies, import/export, and backups.
- Add global search across manuscript, canon, samples, runs, review findings, and reader feedback.
- Finish every stage with TDD, verification, commit, and push.

## Non-Goals

- Do not add cloud sync, external platform connectors, collaboration, or plugin marketplace in V2.
- Do not build Electron/Tauri packaging in V2.
- Do not implement V3 advanced retrieval intelligence, narrative intelligence engines, similarity guard, regression automation, semantic diff, or productization dashboards beyond the V2 usable workflow needs.
- Do not add living-author imitation or a raw sample imitation feature.
- Do not allow agents to silently change canon, overwrite final manuscript text, publish externally, or bypass Context Builder.

## Architecture Impact

- API routes move from demo/in-memory defaults toward injected repositories and durable services.
- `apps/web` becomes API-backed. Demo fixtures remain only inside tests or fallback development factories.
- `packages/llm-gateway` gains a real provider adapter, streaming, prompt versions, redaction, budget checks, and env-based configuration.
- `packages/workflow` gains production workflow contracts for writing, review, memory extraction, import/export, backup/restore, and agent run lifecycle.
- `packages/retrieval` becomes the mandatory path for agent context construction.
- `packages/db` gains missing manuscript/chapter/version/settings/search/prompt-version/provider-budget/approval persistence and repository tests.
- `packages/artifacts` stores draft prose, accepted versions, context packs, review reports, import raw files, backup bundles, and run outputs by hash.
- `packages/evaluation` and observability surface real run metrics through API and Agent Room.

## File Structure and Ownership

### Data Model and Persistence

- Modify `packages/db/src/schema.ts`: add manuscripts, chapters, manuscript_versions, prompt_versions, provider_settings, budget_policies, settings_snapshots, workflow_step_events, artifact_links, global_search_index, and settings/source-policy indexes.
- Modify `packages/db/src/migrate.ts`: create matching SQLite schema and WAL-safe indexes.
- Modify `packages/db/src/check.ts`: include new schema assertions and migration smoke checks.
- Create `packages/db/src/repositories/manuscript.repository.ts`.
- Create `packages/db/src/repositories/prompt-version.repository.ts`.
- Create `packages/db/src/repositories/settings.repository.ts`.
- Create `packages/db/src/repositories/global-search.repository.ts`.
- Modify existing repositories: `project.repository.ts`, `artifact.repository.ts`, `agent-run.repository.ts`, `context-pack.repository.ts`, `memory.repository.ts`, `knowledge.repository.ts`, `workflow-run.repository.ts`, `durable-job.repository.ts`, `llm-call-log.repository.ts`.
- Test files: `packages/db/src/test/manuscript.repository.test.ts`, `prompt-version.repository.test.ts`, `settings.repository.test.ts`, `global-search.repository.test.ts`, plus updated existing repository tests.

### Domain

- Modify `packages/domain/src/project/manuscript.ts`: add manuscript, chapter, chapter version, acceptance decision, and version status rules.
- Modify `packages/domain/src/artifact/artifact.ts`: include draft prose, accepted manuscript version, prompt version, settings snapshot, and backup bundle artifact types if missing.
- Modify `packages/domain/src/agents/llm-gateway.ts`: extend provider adapter contract only when needed for streaming and budget metadata while preserving provider-agnostic boundary.
- Modify `packages/domain/src/agents/context-pack.ts`: include WritingContract, retrieval budget, citations, exclusions, warnings, and prompt version references.
- Modify `packages/domain/src/memory/canon.ts` and `approvals.ts`: add accepted-text extraction result and decision queue helpers.
- Create or modify `packages/domain/src/settings/settings.ts`: provider settings, local secret references, budget policies, source policy defaults, backup settings.
- Test files: matching `.test.ts` files under `packages/domain/src`.

### LLM Gateway

- Create `packages/llm-gateway/src/openai-provider.ts`.
- Create `packages/llm-gateway/src/provider-config.ts`.
- Create `packages/llm-gateway/src/prompt-registry.ts`.
- Create `packages/llm-gateway/src/budget-guard.ts`.
- Modify `packages/llm-gateway/src/gateway.ts`, `fake-provider.ts`, and `index.ts`.
- Test files: `openai-provider.test.ts`, `provider-config.test.ts`, `prompt-registry.test.ts`, `budget-guard.test.ts`, updated `gateway.test.ts`.

### Retrieval and Workflow

- Modify `packages/retrieval/src/context-builder.ts`, `retrieval-policy.ts`, `keyword-search.ts`, `vector-store.ts`.
- Create `packages/workflow/src/writing-workflow.ts`.
- Create `packages/workflow/src/review-workflow.ts`.
- Create `packages/workflow/src/memory-extraction-workflow.ts`.
- Create `packages/workflow/src/agent-room.ts`.
- Modify `packages/workflow/src/workflow-runner.ts`, `durable-job.ts`, `task-contract.ts`, `authorship.ts`, `agents.ts`, `import-workflow.ts`, `export-workflow.ts`.
- Test files: `writing-workflow.test.ts`, `review-workflow.test.ts`, `memory-extraction-workflow.test.ts`, `agent-room.test.ts`, updated existing tests.

### API

- Modify `apps/api/src/app.ts` and `runtime.ts`.
- Create `apps/api/src/routes/manuscripts.routes.ts`.
- Create `apps/api/src/routes/artifacts.routes.ts`.
- Create `apps/api/src/routes/context-packs.routes.ts`.
- Create `apps/api/src/routes/settings.routes.ts`.
- Create `apps/api/src/routes/search.routes.ts`.
- Create `apps/api/src/routes/approvals.routes.ts`.
- Create `apps/api/src/routes/import-export.routes.ts`.
- Modify `projects.routes.ts`, `agent-runs.routes.ts`, `orchestration.routes.ts`, `workbench.routes.ts`, `workflow.routes.ts`.
- Create services: `manuscript.service.ts`, `writing-workflow.service.ts`, `settings.service.ts`, `search.service.ts`, `backup.service.ts`.
- Test files under `apps/api/src/test`: route and service tests for every new flow.

### Web UI

- Modify `apps/web/src/App.tsx`, `api/client.ts`, and `styles.css`.
- Create components:
  - `components/ProjectWorkspace.tsx`
  - `components/ManuscriptWorkbench.tsx`
  - `components/RichTextEditor.tsx`
  - `components/ChapterTree.tsx`
  - `components/ArtifactReviewPanel.tsx`
  - `components/AgentRoom.tsx`
  - `components/RunGraph.tsx`
  - `components/ContextInspector.tsx`
  - `components/ApprovalQueue.tsx`
  - `components/MemoryExtractionPanel.tsx`
  - `components/CanonRetrievalPanel.tsx`
  - `components/ImportExportBackupPanel.tsx`
  - `components/SettingsPanel.tsx`
  - `components/GlobalSearch.tsx`
- Update existing components to consume API data: ProjectDashboard, ManuscriptEditor, StoryBible, ReviewCenter, SerializationDesk, KnowledgeLibrary, ObservabilityDashboard, DecisionQueuePanel.
- Test files under `apps/web/src/test`: component and flow tests.

### E2E

- Modify `tests/e2e/workspace.spec.ts`.
- Create `tests/e2e/writing-flow.spec.ts`.
- Create `tests/e2e/settings-and-backup.spec.ts`.
- Create `tests/e2e/agent-room.spec.ts`.

## TDD Protocol for Every V2 Task

- Write the narrow failing test first.
- Run the exact test and record the expected failure message.
- Implement the smallest code path needed to pass.
- Run the narrow test until it passes.
- Run the phase verification commands.
- Commit and push at the phase boundary.
- If equivalent coverage already exists, record the existing test and why it is equivalent before implementation.
- If a test failure appears, use `superpowers:systematic-debugging` before changing code.
- Test snippets in this plan use local helpers such as `mock*Client`, `*Fixture`, `testRuntimeWithRepositories`, and `jsonResponse`; create those helpers inside the same test file during the failing-test step.

## Subagent Execution Strategy

Use delegated subagents for independent write scopes. Every delegated prompt must include the exact marker `Delegated subagent task`, must state that it is a main-agent delegated subagent task, and must list scope, allowed local actions, forbidden actions, expected output, and owned files.

Suggested parallel ownership:

- DB/repository worker: `packages/db/**` and DB tests.
- Domain/workflow worker: `packages/domain/**`, `packages/workflow/**`, and package tests.
- LLM/retrieval worker: `packages/llm-gateway/**`, `packages/retrieval/**`, and package tests.
- API worker: `apps/api/**` and API tests.
- Web worker: `apps/web/**` and web tests.
- E2E/verification worker: `tests/e2e/**`, Playwright checks, and verification notes.

Workers must not reset git, must not edit another worker's owned files, must not skip failing-test confirmation, and must not call a task complete without listing test output.

## Phase V2-0: Environment, Baseline Verification, and Plan Gate

**Purpose:** Establish that the current baseline can install, test, build, and run DB checks before feature work starts.

**Files:**

- Read: `package.json`, `package-lock.json`, workspace `package.json` files.
- Modify only if dependency installation changes lockfile: `package-lock.json`.
- No product code changes.

**Expected failing test or equivalent coverage:**

- Equivalent coverage exists in current test suites, but dependencies are missing. The expected first failure before `npm install` is command-level, not product-level: `npm test` fails because workspace dependencies are absent.

**Steps:**

- [ ] Run `npm install`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm run db:check`.
- [ ] Run `npm run test:e2e`.
- [ ] Record any baseline failure as an Open Question only if non-blocking; use systematic debugging if it blocks V2.

**Verification commands:**

```bash
npm install
npm test
npm run build
npm run db:check
npm run test:e2e
git status --short
```

**Commit boundary:** Commit only if `package-lock.json` changes or baseline docs are updated.

## Phase V2-1: Real LLM Gateway, Prompt Versions, Streaming, Secrets, and Budgets

**Design coverage:** LLM Gateway lines 1343-1369, safety and rights lines 1451-1462, implementation defaults lines 1545-1554, observability lines 1393-1406.

**Files:**

- Create `packages/llm-gateway/src/openai-provider.ts`
- Create `packages/llm-gateway/src/provider-config.ts`
- Create `packages/llm-gateway/src/prompt-registry.ts`
- Create `packages/llm-gateway/src/budget-guard.ts`
- Modify `packages/llm-gateway/src/gateway.ts`
- Modify `packages/llm-gateway/src/fake-provider.ts`
- Modify `packages/llm-gateway/src/index.ts`
- Modify `packages/domain/src/agents/llm-gateway.ts`
- Create `packages/db/src/repositories/prompt-version.repository.ts`
- Create `packages/db/src/repositories/settings.repository.ts`
- Modify `packages/db/src/schema.ts`, `migrate.ts`, `index.ts`
- Defer settings HTTP routes to Phase V2-9; V2-1 owns provider config, prompt versions, and persistence contracts.

**Expected failing tests:**

```ts
// packages/llm-gateway/src/openai-provider.test.ts
it('builds OpenAI requests from env-backed provider settings without exposing api keys in logs', async () => {
  const provider = createOpenAIProvider({
    apiKey: 'sk-local-test-secret',
    baseURL: 'https://api.openai.com/v1',
    fetch: async (url, init) => {
      expect(String(init?.headers)).not.toContain('sk-local-test-secret');
      return jsonResponse({ id: 'chatcmpl_test', choices: [{ message: { content: 'Draft' } }], usage: { prompt_tokens: 2, completion_tokens: 3 } });
    }
  });

  const result = await provider.generateText({ model: 'gpt-test', prompt: 'write' });
  expect(result.text).toBe('Draft');
});
```

Expected first failure: `createOpenAIProvider` is not exported.

```ts
// packages/llm-gateway/src/budget-guard.test.ts
it('blocks a model call before provider execution when the estimated cost exceeds the configured run budget', async () => {
  const provider = createFakeProvider({ text: 'unused', structured: {}, embedding: [], usage: { inputTokens: 1000, outputTokens: 1000 } });
  const gateway = new LlmGateway({ provider, defaultModel: 'fake-model', budget: { maxRunCostUsd: 0.0001 } });

  await expect(gateway.generateText({ prompt: 'expensive' })).rejects.toThrow(/budget/i);
});
```

Expected first failure: `budget` is not a valid `LlmGatewayOptions` property.

```ts
// packages/llm-gateway/src/prompt-registry.test.ts
it('requires every persisted agent run prompt to resolve to a prompt version', () => {
  const registry = createPromptRegistry([{ id: 'writer.v2.1', taskType: 'draft_prose', template: 'Write {{goal}}' }]);
  expect(registry.resolve('writer.v2.1').taskType).toBe('draft_prose');
  expect(() => registry.resolve('missing')).toThrow(/PromptVersion/);
});
```

Expected first failure: `createPromptRegistry` is not exported.

```ts
// packages/llm-gateway/src/gateway.test.ts
it('streams text chunks through the gateway and records prompt version and usage when the stream closes', async () => {
  const gateway = new LlmGateway({ provider: createFakeProvider({ text: 'A B', structured: {}, embedding: [], usage: { inputTokens: 1, outputTokens: 2 } }), defaultModel: 'fake-model', promptVersionId: 'writer.v2.1' });
  const chunks: string[] = [];
  for await (const chunk of gateway.streamText({ prompt: 'continue' })) chunks.push(chunk);

  expect(chunks.join('')).toBe('A B');
  expect(gateway.callLog[0]).toMatchObject({ promptVersionId: 'writer.v2.1', status: 'Succeeded' });
});
```

Expected first failure: stream calls are not logged.

**Implementation steps:**

- [ ] Add provider config types that accept local secret references and runtime-resolved env values.
- [ ] Add OpenAI provider methods for text, structured JSON, streaming, embeddings, and cost estimation.
- [ ] Add test fetch injection so provider tests never call the network.
- [ ] Add redaction helpers and assert logs never include raw API keys.
- [ ] Add prompt registry and DB repository for prompt versions.
- [ ] Add budget guard before provider calls and context truncation warnings after context construction.
- [ ] Extend gateway call logging for text, structured, stream, and embeddings.
- [ ] Keep fake provider deterministic for unit tests.

**Verification commands:**

```bash
npm test -- packages/llm-gateway
npm test -- packages/domain/src/agents/llm-gateway.test.ts
npm test -- packages/db/src/test/prompt-version.repository.test.ts packages/db/src/test/settings.repository.test.ts
npm run db:check
```

**Commit boundary:** `feat: wire real llm gateway provider boundary`

## Phase V2-2: Persisted Project, Manuscript, Chapter, Artifact, AgentRun, and ContextPack CRUD

**Design coverage:** Main workspace lines 101-132, manuscript entities lines 136-148, storage rules lines 357-381, agent entities lines 243-300.

**Files:**

- Modify `packages/domain/src/project/manuscript.ts`
- Create `packages/db/src/repositories/manuscript.repository.ts`
- Modify `packages/db/src/schema.ts`, `migrate.ts`, `index.ts`
- Create `apps/api/src/routes/manuscripts.routes.ts`
- Create `apps/api/src/routes/artifacts.routes.ts`
- Create `apps/api/src/routes/context-packs.routes.ts`
- Create `apps/api/src/services/manuscript.service.ts`
- Modify `apps/api/src/app.ts`, `runtime.ts`
- Modify existing route tests and create manuscript/artifact/context-pack route tests.

**Expected failing tests:**

```ts
// packages/domain/src/project/manuscript.test.ts
it('creates a new chapter version without overwriting the accepted manuscript text', () => {
  const chapter = createChapter({ title: 'Chapter 1', order: 1 });
  const draft = createManuscriptVersion({ chapterId: chapter.id, artifactId: 'artifact_draft', status: 'Draft' });
  const accepted = acceptManuscriptVersion(chapter, draft, { acceptedBy: 'author', reason: 'fits contract' });

  expect(accepted.currentVersionId).toBe(draft.id);
  expect(accepted.versions).toHaveLength(1);
});
```

Expected first failure: `createManuscriptVersion` and `acceptManuscriptVersion` are not exported.

```ts
// packages/db/src/test/manuscript.repository.test.ts
it('persists manuscripts, chapters, and ordered chapter versions for a project', async () => {
  const repository = createManuscriptRepository(db);
  const saved = await repository.createChapterWithVersion({ projectId: 'project_abc', title: 'Opening', bodyArtifactId: 'artifact_body_1' });
  const chapters = await repository.listChapters('project_abc');

  expect(chapters[0]).toMatchObject({ id: saved.chapter.id, title: 'Opening', currentVersionId: saved.version.id });
});
```

Expected first failure: `createManuscriptRepository` is not exported.

```ts
// apps/api/src/test/manuscripts.routes.test.ts
it('creates, updates, versions, and reads a chapter through the API', async () => {
  const app = buildApp(testRuntimeWithRepositories());
  const create = await app.inject({ method: 'POST', url: '/projects/project_abc/chapters', payload: { title: 'Opening', body: 'Line one.' } });
  const update = await app.inject({ method: 'POST', url: `/chapters/${create.json().id}/versions`, payload: { body: 'Line one revised.' } });

  expect(create.statusCode).toBe(201);
  expect(update.statusCode).toBe(201);
});
```

Expected first failure: route returns 404.

**Implementation steps:**

- [ ] Add domain version entities with explicit Draft, Accepted, Rejected, Superseded states.
- [ ] Add DB tables and repositories for manuscript, chapter, and version pointers.
- [ ] Store version bodies as artifacts and keep DB rows as metadata/pointers.
- [ ] Add API CRUD for project manuscripts, chapters, chapter versions, artifacts, agent runs, and context packs.
- [ ] Ensure every AgentRun references a PromptVersion and ContextPack.
- [ ] Add route-level Zod validation and 404 behavior for missing projects/chapters/artifacts.

**Verification commands:**

```bash
npm test -- packages/domain/src/project
npm test -- packages/db/src/test/manuscript.repository.test.ts packages/db/src/test/artifact.repository.test.ts packages/db/src/test/agent-run.repository.test.ts packages/db/src/test/context-pack.repository.test.ts
npm test -- apps/api/src/test/manuscripts.routes.test.ts apps/api/src/test/agent-runs.routes.test.ts
npm run db:check
```

**Commit boundary:** `feat: add persisted manuscript and run crud`

## Phase V2-3: API-Backed UI Shell and Global Data Client

**Design coverage:** Main workspace lines 101-132, command/search requirements lines 121-132, local Web workspace lines 23-33.

**Files:**

- Modify `apps/web/src/api/client.ts`
- Create `apps/web/src/api/projects.ts`
- Create `apps/web/src/api/manuscripts.ts`
- Create `apps/web/src/api/runs.ts`
- Create `apps/web/src/api/settings.ts`
- Modify `apps/web/src/App.tsx`
- Modify `apps/web/src/components/ProjectDashboard.tsx`
- Create `apps/web/src/components/ProjectWorkspace.tsx`
- Create `apps/web/src/components/GlobalSearch.tsx`
- Modify `apps/web/src/styles.css`
- Tests under `apps/web/src/test`.

**Expected failing tests:**

```tsx
// apps/web/src/test/api-backed-workspace.test.tsx
it('loads project, chapter, decision, and run counts from the API instead of static demo data', async () => {
  render(<App apiBaseUrl="/api" fetchImpl={mockFetchWithProjectWorkspace()} />);

  expect(await screen.findByText('The Archive City')).toBeInTheDocument();
  expect(screen.getByText('Draft Chapters')).toBeInTheDocument();
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});
```

Expected first failure: `App` does not accept `apiBaseUrl` or `fetchImpl`, and dashboard uses static data.

```tsx
// apps/web/src/test/global-search.test.tsx
it('shows grouped search results from manuscript, canon, samples, runs, review findings, and reader feedback', async () => {
  render(<GlobalSearch client={mockSearchClient()} />);
  await userEvent.type(screen.getByRole('searchbox', { name: 'Global search' }), 'bell');

  expect(await screen.findByRole('heading', { name: 'Manuscript' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Canon' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Runs' })).toBeInTheDocument();
});
```

Expected first failure: `GlobalSearch` does not exist.

**Implementation steps:**

- [ ] Add typed API client modules and injected fetch for tests.
- [ ] Replace static dashboard counts with API data and loading/error states.
- [ ] Add workspace project selector and current project context.
- [ ] Add global search UI with grouped results and keyboard-safe form behavior.
- [ ] Keep layout dense and utilitarian; do not add a landing page.

**Verification commands:**

```bash
npm test -- apps/web/src/test/api-backed-workspace.test.tsx apps/web/src/test/global-search.test.tsx
npm test -- apps/web/src/test/App.test.tsx
```

**Commit boundary:** `feat: connect workspace ui to api data`

## Phase V2-4: Editor Workbench, TipTap or Equivalent, Version Acceptance, and Artifact Review

**Design coverage:** Manuscript Editor lines 108 and 125-129, authorship rules lines 902-937, revision diff lines 1175-1254, technical editor default line 1303.

**Files:**

- Create `apps/web/src/components/RichTextEditor.tsx`
- Create `apps/web/src/components/ChapterTree.tsx`
- Create `apps/web/src/components/ArtifactReviewPanel.tsx`
- Modify `apps/web/src/components/ManuscriptEditor.tsx`
- Modify `apps/web/src/api/manuscripts.ts`
- Add web tests for editor and artifact acceptance.
- Modify `apps/api/src/routes/manuscripts.routes.ts` and `apps/api/src/services/manuscript.service.ts` if acceptance endpoint is missing.

**Expected failing tests:**

```tsx
// apps/web/src/test/editor-workbench.test.tsx
it('edits a selected chapter and saves a new draft version through the API', async () => {
  render(<ManuscriptWorkbench client={mockManuscriptClient()} />);
  await userEvent.click(await screen.findByRole('treeitem', { name: 'Chapter 1' }));
  await userEvent.type(screen.getByRole('textbox', { name: 'Chapter editor' }), ' new sentence');
  await userEvent.click(screen.getByRole('button', { name: 'Save draft version' }));

  expect(await screen.findByText('Draft version saved')).toBeInTheDocument();
});
```

Expected first failure: `ManuscriptWorkbench` and editor controls do not exist.

```tsx
// apps/web/src/test/artifact-review-panel.test.tsx
it('accepts or rejects a draft artifact and only accepted text becomes the current manuscript version', async () => {
  render(<ArtifactReviewPanel artifact={draftArtifact()} client={mockAcceptanceClient()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Accept draft' }));

  expect(await screen.findByText('Accepted into manuscript version')).toBeInTheDocument();
});
```

Expected first failure: `ArtifactReviewPanel` does not exist.

**Implementation steps:**

- [ ] Add editor abstraction using TipTap if installation is stable; otherwise implement an equivalent rich text boundary with the same props and record the dependency reason.
- [ ] Add chapter tree with stable dimensions and current selection.
- [ ] Add save draft, compare, accept, reject, and partial accept controls.
- [ ] Persist draft text as artifacts and accepted text as manuscript versions.
- [ ] Ensure agent-authored prose cannot become accepted text without explicit user action.

**Verification commands:**

```bash
npm test -- apps/web/src/test/editor-workbench.test.tsx apps/web/src/test/artifact-review-panel.test.tsx
npm test -- apps/api/src/test/manuscripts.routes.test.ts
npm test -- packages/workflow/src/authorship.test.ts
```

**Commit boundary:** `feat: add manuscript editor version acceptance flow`

## Phase V2-5: Writing Runtime and Agent-Assisted Authoring Flow

**Design coverage:** Authorship Control lines 888-952, Agent-Assisted Authoring lines 1018-1033, Context Builder lines 1058-1126, Agent Operating System lines 954-983.

**Files:**

- Create `packages/workflow/src/writing-workflow.ts`
- Modify `packages/workflow/src/authorship.ts`, `task-contract.ts`, `workflow-runner.ts`, `agents.ts`
- Modify `packages/retrieval/src/context-builder.ts`
- Modify `apps/api/src/services/agent-orchestration.service.ts`
- Create `apps/api/src/services/writing-workflow.service.ts`
- Modify `apps/api/src/routes/orchestration.routes.ts`, `workflow.routes.ts`
- Create `apps/api/src/test/writing-workflow.routes.test.ts`
- Create web flow tests for writing request.

**Expected failing tests:**

```ts
// packages/workflow/src/writing-workflow.test.ts
it('runs WritingContract, ContextPack, Writer, Review, draft artifact, and acceptance gates in order', async () => {
  const result = await runWritingWorkflow({
    projectId: 'project_abc',
    chapterId: 'chapter_abc',
    authorshipLevel: 'A3',
    goal: 'Draft the siege chapter',
    buildContextPack: fakeContextPackBuilder(),
    writeDraft: fakeWriterDraft('Draft prose'),
    reviewDraft: fakeReviewerPass()
  });

  expect(result.steps.map((step) => step.name)).toEqual([
    'create_writing_contract',
    'build_context_pack',
    'run_writer_agent',
    'store_draft_artifact',
    'run_review_agent',
    'await_author_acceptance'
  ]);
});
```

Expected first failure: `runWritingWorkflow` is not exported.

```ts
// apps/api/src/test/writing-workflow.routes.test.ts
it('starts a writing workflow without accepting the generated prose automatically', async () => {
  const response = await app.inject({ method: 'POST', url: '/projects/project_abc/writing-runs', payload: writingRequest() });
  const body = response.json();

  expect(response.statusCode).toBe(202);
  expect(body.artifact.status).toBe('Draft');
  expect(body.manuscriptVersionId).toBeNull();
});
```

Expected first failure: route returns 404.

**Implementation steps:**

- [ ] Define writing workflow input and WritingContract schema.
- [ ] Force context construction through `packages/retrieval` rather than client-provided sections.
- [ ] Generate draft artifact through LLM Gateway and store run graph.
- [ ] Run self-check and review agent with typed artifacts.
- [ ] Return draft and review state to UI without accepting text.
- [ ] Add accept/reject endpoint that writes accepted versions and triggers memory extraction.

**Verification commands:**

```bash
npm test -- packages/workflow/src/writing-workflow.test.ts packages/workflow/src/authorship.test.ts
npm test -- packages/retrieval/src/context-builder.test.ts
npm test -- apps/api/src/test/writing-workflow.routes.test.ts apps/api/src/test/agent-orchestration.service.test.ts
```

**Commit boundary:** `feat: add writing runtime workflow`

## Phase V2-6: Memory Extraction, Canon, Retrieval, and Source-Policy Workflows

**Design coverage:** Memory system lines 383-430, Retrieval lines 1058-1126, Knowledge lines 1127-1174, safety and rights lines 1451-1462.

**Files:**

- Create `packages/workflow/src/memory-extraction-workflow.ts`
- Modify `packages/domain/src/memory/canon.ts`, `approvals.ts`
- Modify `packages/retrieval/src/context-builder.ts`, `retrieval-policy.ts`, `keyword-search.ts`
- Modify `packages/db/src/repositories/memory.repository.ts`, `knowledge.repository.ts`, `search.repository.ts`
- Create `apps/api/src/routes/approvals.routes.ts`
- Create `apps/api/src/routes/search.routes.ts`
- Modify `apps/api/src/routes/workbench.routes.ts`
- Create web components `MemoryExtractionPanel.tsx` and `CanonRetrievalPanel.tsx`
- Update `KnowledgeLibrary.tsx` and `StoryBible.tsx`.

**Expected failing tests:**

```ts
// packages/workflow/src/memory-extraction-workflow.test.ts
it('extracts candidate memory only from accepted manuscript text and sends high-risk canon changes to approvals', async () => {
  const result = await extractMemoryFromAcceptedText({ projectId: 'project_abc', manuscriptVersionId: 'version_abc', text: 'The bell is alive.' });

  expect(result.candidates).toHaveLength(1);
  expect(result.approvalRequests[0]).toMatchObject({ riskLevel: 'High', status: 'Pending' });
});
```

Expected first failure: `extractMemoryFromAcceptedText` is not exported.

```ts
// packages/retrieval/src/context-builder.test.ts
it('retrieves canon, negative memory, active reader promises, and source-policy warnings with a trace', () => {
  const pack = buildContextPack(retrievalFixtureWithNegativeMemoryAndRestrictedSample());

  expect(pack.sections.some((section) => section.name === 'negative_memory')).toBe(true);
  expect(pack.warnings).toContain('Excluded sample_1 due to source policy');
  expect(pack.retrievalTrace).toContain('source_policy:sample_1:excluded');
});
```

Expected first failure: negative memory section and trace detail are absent.

```tsx
// apps/web/src/test/canon-retrieval-panel.test.tsx
it('shows retrieval citations, exclusions, and approval-needed memory candidates', async () => {
  render(<CanonRetrievalPanel client={mockCanonClient()} />);

  expect(await screen.findByText('Candidate memory')).toBeInTheDocument();
  expect(screen.getByText('Excluded due to source policy')).toBeInTheDocument();
});
```

Expected first failure: component does not exist.

**Implementation steps:**

- [ ] Add accepted-text-only memory extraction workflow.
- [ ] Persist candidate facts and approval requests.
- [ ] Add retrieval sections for canon, negative memory, promises, source-policy warnings, and citations.
- [ ] Add UI to inspect candidates, approve/reject memory, and inspect context exclusions.
- [ ] Add search indexing for manuscript, canon, knowledge, runs, review findings, and feedback.

**Verification commands:**

```bash
npm test -- packages/workflow/src/memory-extraction-workflow.test.ts
npm test -- packages/domain/src/memory
npm test -- packages/retrieval
npm test -- packages/db/src/test/memory.repository.test.ts packages/db/src/test/search.repository.test.ts
npm test -- apps/api/src/test/approvals.routes.test.ts apps/api/src/test/search.routes.test.ts
npm test -- apps/web/src/test/canon-retrieval-panel.test.tsx
```

**Commit boundary:** `feat: add usable memory canon retrieval workflows`

## Phase V2-7: Agent Room, Run Graph, Context Inspector, Artifacts, and Decision Queue

**Design coverage:** Agent Room lines 110-115, context inspector lines 121-127, decision queue and risk gates lines 47, 85-99, 879-886, AgentRun trace lines 287-300.

**Files:**

- Create `packages/workflow/src/agent-room.ts`
- Modify `packages/db/src/repositories/workflow-run.repository.ts`, `durable-job.repository.ts`, `agent-run.repository.ts`, `context-pack.repository.ts`, `artifact.repository.ts`
- Modify `apps/api/src/routes/agent-runs.routes.ts`, `workflow.routes.ts`, `context-packs.routes.ts`, `artifacts.routes.ts`, `approvals.routes.ts`
- Create `apps/web/src/components/AgentRoom.tsx`
- Create `apps/web/src/components/RunGraph.tsx`
- Create `apps/web/src/components/ContextInspector.tsx`
- Create `apps/web/src/components/ApprovalQueue.tsx`
- Modify `DecisionQueuePanel.tsx`.

**Expected failing tests:**

```ts
// apps/api/src/test/agent-room.routes.test.ts
it('returns a run detail with graph steps, context pack, artifacts, approvals, costs, and retry state', async () => {
  const response = await app.inject({ method: 'GET', url: '/agent-room/runs/agent_run_abc' });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    run: { id: 'agent_run_abc' },
    contextPack: { id: 'context_pack_abc' },
    graph: [{ name: 'build_context_pack' }],
    approvals: [{ status: 'Pending' }]
  });
});
```

Expected first failure: route returns 404.

```tsx
// apps/web/src/test/agent-room.test.tsx
it('lets the author inspect a run graph, context pack citations, artifacts, and approval requests', async () => {
  render(<AgentRoom client={mockAgentRoomClient()} />);

  expect(await screen.findByRole('heading', { name: 'Agent Room' })).toBeInTheDocument();
  expect(screen.getByText('Context citations')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
});
```

Expected first failure: `AgentRoom` does not exist.

**Implementation steps:**

- [ ] Add run detail read model that joins AgentRun, WorkflowRun, ContextPack, Artifact, LLM logs, approvals, and job status.
- [ ] Add cancel, retry, and replay actions only where workflow state allows them.
- [ ] Add UI for run list, run detail, graph, context inspector, artifacts, approvals, and cost.
- [ ] Route high-risk events to approval queue and expose approve/reject actions.

**Verification commands:**

```bash
npm test -- packages/workflow/src/agent-room.test.ts
npm test -- apps/api/src/test/agent-room.routes.test.ts apps/api/src/test/agent-runs.routes.test.ts
npm test -- apps/web/src/test/agent-room.test.tsx apps/web/src/test/workbench-panels.test.tsx
```

**Commit boundary:** `feat: add agent room and decision queue`

## Phase V2-8: Import, Export, Backup, Restore, and Portable Bundle UI

**Design coverage:** Import/export/backup lines 1408-1449, durable jobs lines 1371-1391, storage rules lines 357-381.

**Files:**

- Modify `packages/workflow/src/import-workflow.ts`, `export-workflow.ts`
- Modify `packages/db/src/repositories/project-bundle.repository.ts`
- Create `apps/api/src/routes/import-export.routes.ts`
- Create `apps/api/src/services/backup.service.ts`
- Create `apps/web/src/components/ImportExportBackupPanel.tsx`
- Modify `KnowledgeLibrary.tsx` or Settings if needed to surface bundle operations.
- Add API, workflow, web, and e2e tests.

**Expected failing tests:**

```ts
// apps/api/src/test/import-export.routes.test.ts
it('creates a backup bundle, verifies its hash, restores it, and records rollback actions', async () => {
  const backup = await app.inject({ method: 'POST', url: '/projects/project_abc/backups' });
  const restore = await app.inject({ method: 'POST', url: '/projects/project_restored/restore', payload: { backupHash: backup.json().hash } });

  expect(backup.statusCode).toBe(201);
  expect(restore.statusCode).toBe(201);
  expect(restore.json().rollbackActions).toContain('delete_restored_project');
});
```

Expected first failure: routes return 404.

```tsx
// apps/web/src/test/import-export-backup-panel.test.tsx
it('starts import, export, backup, and restore workflows from the UI and shows job status', async () => {
  render(<ImportExportBackupPanel client={mockBackupClient()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Create backup' }));

  expect(await screen.findByText('Backup queued')).toBeInTheDocument();
});
```

Expected first failure: component does not exist.

**Implementation steps:**

- [ ] Wrap existing import/export helpers in durable workflows with job status.
- [ ] Add API endpoints for import, export, backup, restore, hash verification, and restore record lookup.
- [ ] Add UI for import file/paste, export targets, backup creation, restore verification, and restore result.
- [ ] Ensure restore rejects tampered bundles before writing restored state.

**Verification commands:**

```bash
npm test -- packages/workflow/src/import-export.test.ts
npm test -- packages/db/src/test/project-bundle.repository.test.ts
npm test -- apps/api/src/test/import-export.routes.test.ts
npm test -- apps/web/src/test/import-export-backup-panel.test.tsx
```

**Commit boundary:** `feat: add import export backup restore ui`

## Phase V2-9: Settings, Provider Budgets, Source Policies, and Local Secrets Boundary

**Design coverage:** Settings lines 115 and 130-132, SourcePolicy lines 311-332, safety and rights lines 1451-1462, budgets lines 271-273 and 866-872.

**Files:**

- Create `packages/domain/src/settings/settings.ts`
- Modify `packages/db/src/repositories/settings.repository.ts` created in V2-1
- Create `apps/api/src/routes/settings.routes.ts`
- Create `apps/api/src/services/settings.service.ts`
- Create `apps/web/src/components/SettingsPanel.tsx`
- Modify `KnowledgeLibrary.tsx`
- Modify `packages/llm-gateway/src/provider-config.ts`, `budget-guard.ts`

**Expected failing tests:**

```ts
// apps/api/src/test/settings.routes.test.ts
it('stores provider defaults and budget policies without returning raw api keys', async () => {
  const save = await app.inject({ method: 'PUT', url: '/settings/providers/openai', payload: { apiKey: 'sk-local-secret', model: 'gpt-test', maxRunCostUsd: 0.25 } });
  const read = await app.inject({ method: 'GET', url: '/settings/providers/openai' });

  expect(save.statusCode).toBe(200);
  expect(read.json().apiKey).toBeUndefined();
  expect(read.json().secretRef).toBe('env:OPENAI_API_KEY');
});
```

Expected first failure: route returns 404.

```tsx
// apps/web/src/test/settings-panel.test.tsx
it('edits provider model, budget, source-policy defaults, and backup settings', async () => {
  render(<SettingsPanel client={mockSettingsClient()} />);
  await userEvent.type(await screen.findByLabelText('Default model'), 'gpt-test');
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));

  expect(await screen.findByText('Settings saved')).toBeInTheDocument();
});
```

Expected first failure: `SettingsPanel` does not exist.

**Implementation steps:**

- [ ] Add settings domain model and repository.
- [ ] Store API key references, not raw secret values, in DB.
- [ ] Add provider defaults, model routing defaults, cost/attention budgets, source-policy defaults, backup settings.
- [ ] Add settings API with redacted responses.
- [ ] Add Settings UI with form validation and saved state.

**Verification commands:**

```bash
npm test -- packages/domain/src/settings/settings.test.ts
npm test -- packages/db/src/test/settings.repository.test.ts
npm test -- apps/api/src/test/settings.routes.test.ts
npm test -- apps/web/src/test/settings-panel.test.tsx
npm test -- packages/llm-gateway/src/budget-guard.test.ts
```

**Commit boundary:** `feat: add settings providers budgets source policies`

## Phase V2-10: Full Verification, Browser Check, and Push Gate

**Design coverage:** Full design acceptance criteria lines 1556-1583.

**Files:**

- Modify only failing tests or minimal fixes discovered during verification.
- Modify `tests/e2e/*.spec.ts` to cover key workflows.

**Expected failing tests:**

```ts
// tests/e2e/writing-flow.spec.ts
test('author creates a chapter, runs a writing workflow, reviews a draft, accepts it, and sees memory candidates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New chapter' }).click();
  await page.getByRole('button', { name: 'Run writer' }).click();
  await expect(page.getByText('Draft artifact')).toBeVisible();
  await page.getByRole('button', { name: 'Accept draft' }).click();
  await expect(page.getByText('Candidate memory')).toBeVisible();
});
```

Expected first failure before implementation: controls or API-backed state are missing.

**Implementation steps:**

- [ ] Add E2E coverage for project/chapter CRUD, writing workflow, Agent Room inspection, settings save, backup/restore, and global search.
- [ ] Run all unit and integration tests.
- [ ] Run build.
- [ ] Run DB check.
- [ ] Run E2E.
- [ ] Start local dev servers and use browser checks for primary UI flows.
- [ ] Fix verified failures through systematic debugging.
- [ ] Commit and push after the gate passes.

**Verification commands:**

```bash
npm test
npm run build
npm run db:check
npm run test:e2e
git status --short
git push -u origin codex/v2-v3-implementation
```

**Commit boundary:** `test: verify v2 production workflows`

## V2 Coverage Matrix

| V2 requirement | Design anchor | Plan phase |
| --- | --- | --- |
| Real OpenAI/LLM provider adapter and local env/secrets boundary | LLM Gateway 1343-1369; Safety 1451-1462; Defaults 1554 | V2-1, V2-9 |
| Provider wiring, prompt versions, streaming, budget control | AgentRun 287-300; LLM Gateway 1343-1369; budgets 271-273 | V2-1 |
| API-backed UI flows, replace static demo data | Main Workspace 101-132 | V2-3 |
| Project / Manuscript / Chapter CRUD and versioning | Manuscript entities 136-148; Storage 357-381 | V2-2, V2-4 |
| TipTap or equivalent editor | Technical Architecture 1303 | V2-4 |
| WritingContract, ContextPack, Writer, artifact, review, accept/reject | Authorship 888-952; Workflows 1018-1033 | V2-5 |
| Agent Room: runs, context packs, graph, artifacts, approvals | Main Workspace 110-127; AgentRun 287-300 | V2-7 |
| Memory extraction from accepted text | Memory 417-430; Authorship 937 | V2-6 |
| Canon / Retrieval usable workflow | Memory 383-430; Retrieval 1058-1126 | V2-6 |
| Import / Export / Backup / Restore UI | Import/export/backup 1408-1449 | V2-8 |
| Settings: providers, budgets, source policies | Settings 115; SourcePolicy 311-332; Safety 1451-1462 | V2-9 |
| Global search | Main Workspace 128; Storage 363 | V2-3, V2-6 |
| Decision queue and approval requests | Governance 85-99; Runtime risk gates 879-886 | V2-6, V2-7 |
| Testing, build, browser check, commit/push gate | Acceptance criteria 1556-1583 | V2-0 through V2-10 |

## V2 / V3 / Deferred Boundary

V2 does:

- Usable local writing product flows.
- Real provider boundary and budgets.
- Persistent CRUD and versioning.
- API-backed UI.
- Agent writing, review, accept/reject, memory extraction.
- Agent Room and decision queue.
- Import/export/backup/restore UI.
- Settings and global search.

V3 does:

- Advanced vector retrieval intelligence, reranking, compression, negative memory scoring, retrieval regression suite.
- Advanced narrative engines for promises, secrets, arcs, timeline, world rules, branch/retcon/regression automation.
- Similarity guard and rights/safety enforcement beyond V2 source-policy gating.
- Review learning, trends, recurring issue intelligence.
- Serialization intelligence and productization dashboards.
- Version history and semantic diff across manuscript, canon, prompt, run, context pack, and artifact.

Deferred by design:

- External platform connectors: design treats them as extension modules behind import interface.
- Cloud sync and multi-user collaboration: outside local-first V2 boundary.
- Electron/Tauri packaging: V3 feasibility spike only if design permits.
- Fully autonomous publishing or content mill behavior: rejected by product positioning.
- Living-author imitation: rejected by style handling and safety requirements.

## Risks

- Current orchestration is synchronous and fake-provider oriented. V2 must define durable job, context, artifact, and run contracts before building UI on top of workflows.
- Current orchestration allows caller-provided context sections. V2 must force all agent runs through Context Builder to meet the design.
- Current UI has static demo panels. Replacing all of them at once is risky, so phase work should migrate one vertical flow at a time.
- No `node_modules` exists in the workspace. Dependency installation may reveal lockfile or platform issues.
- TipTap may add dependency size and browser-test complexity. If TipTap install fails, use an equivalent editor abstraction and record the reason.
- Existing `origin` differs from the user-provided SSH alias. Push may require remote adjustment if authentication fails.

## Assumptions

- The current merged `main` is the V1 baseline, even though the original V1 plan contains outdated feature-branch assumptions.
- V2 should harden and connect existing modules rather than rebuild from scratch.
- OpenAI is the first real provider because the design names it as the initial provider default.
- API keys are read from local environment or local secret references; raw secret values are never returned from API or persisted in logs.
- Existing fake provider remains the default for automated tests.
- Non-blocking issues are recorded as Assumptions or Open Questions and do not stop the work.

## Open Questions

- Whether `origin` should be switched to `git@github.com-baphometwei:BaphometWei/ai-novel.git` before push if current remote authentication succeeds.
- Whether the editor dependency must be TipTap specifically or whether an equivalent rich text editor abstraction is acceptable if TipTap causes dependency issues.
- Whether backup scheduling belongs in V2 settings UI or waits for V3 Observability and Productization. This plan keeps manual backup/restore in V2 and scheduled backup in V3.

## Self-Review Checklist

- [ ] Every V2 user requirement maps to a design anchor and plan phase.
- [ ] Every phase has an expected failing test or records equivalent existing coverage.
- [ ] Every phase has implementation steps, verification commands, and a commit boundary.
- [ ] File ownership is split so DB, API, web, workflow, LLM, retrieval, and E2E tasks can be delegated without write conflicts.
- [ ] Plan does not change stack, product positioning, or local-first boundary.
- [ ] Plan does not allow agents to bypass Context Builder or silently change canon/manuscript.
- [ ] Plan records non-blocking remote, dependency, and editor assumptions.
- [ ] Plan has no unverified completion claims.
