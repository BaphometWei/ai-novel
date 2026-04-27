# AI Novel Agent V3 Intelligence and Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build advanced retrieval intelligence, narrative intelligence engines, governance, review learning, serialization intelligence, branch/retcon/regression automation, version history/diff, and productized observability on top of the verified V2 local writing product.

**Architecture:** V3 extends the same modular monolith and local-first storage model. Advanced intelligence lives in domain/retrieval/workflow/evaluation packages with persistent DB repositories and API/UI surfaces where the design requires user inspection, approval, traceability, or operational use.

**Tech Stack:** React, Vite, TypeScript, Node.js, Fastify, Zod, Drizzle ORM, SQLite with WAL, SQLite FTS plus vector retrieval adapter, Vitest, Playwright, npm workspaces.

---

## Preconditions

V3 starts only after the V2 completion gate passes:

- `npm test` passes.
- `npm run build` passes.
- `npm run db:check` passes.
- `npm run test:e2e` passes for key V2 workflows.
- Browser check confirms project/chapter CRUD, writing workflow, Agent Room, settings, backup/restore, global search, and approval queue are usable.
- V2 coverage matrix maps every V2 item back to the system design document.

## Design Anchors

This plan is derived from `docs/superpowers/specs/2026-04-26-ai-novel-agent-full-system-design.md`:

- Core principles: lines 36-49.
- Main Workspace: lines 101-132.
- Domain model: lines 134-356.
- Storage rules and invariants: lines 357-381.
- Memory system: lines 383-430.
- Foreshadowing and Reader Promise: lines 432-572.
- Secrets, knowledge boundary, and reveal: lines 573-610.
- Character arcs, motivation, and relationships: lines 611-640.
- Timeline, location, and causality: lines 642-670.
- World rule, power, and constraint: lines 672-702.
- Narrative dependency index: lines 704-728.
- Change impact, retcon, and regression: lines 730-758.
- Branch sandbox and scenario simulation: lines 759-785.
- Ending, closure, and final payoff: lines 787-816.
- Creative Copilot Runtime and Authorship Control: lines 840-952.
- Review and Revision: lines 1175-1254.
- Serialization: lines 1255-1295.
- Technical architecture and retrieval defaults: lines 1297-1369 and 1545-1554.
- Durable jobs, observability, import/export/backup, safety: lines 1371-1462.
- Acceptance criteria: lines 1556-1583.

## Goals

- Implement persistent vector retrieval with SQLite-backed local vector storage and embedding records.
- Add retrieval reranking, context budget compression, negative memory, recency/authority/source-policy scoring, and retrieval regression evaluation.
- Build narrative intelligence engines for promises, secrets, arcs, timeline/causality, world rules, ending closure, and final payoff.
- Add governance and safety checks: similarity guard, rights/source-policy enforcement, canon conflict escalation, authorship control audit trail.
- Add review finding lifecycle, recurring issue detection, quality trends, and revision recheck after manuscript changes.
- Add serialization intelligence: platform profiles, title/hook/recap/cliffhanger recommendations, churn signals, reader feedback strategy, burnout and pacing warnings.
- Add branch sandbox visual impact map, retcon proposal workflow, and regression checks across canon/manuscript/timeline/promise/secret/world-rule.
- Add version history across manuscript, canon, prompt, run, context pack, and artifact, plus semantic narrative diff and restore/compare workflows.
- Productize observability dashboards with real run data, cost/latency/token/quality metrics, backup scheduling, migration management, and desktop feasibility spike if design constraints still allow it.

## Non-Goals

- Do not redo V2 CRUD, editor, settings, or basic workflow work.
- Do not add cloud sync, multi-user collaboration, plugin marketplace, external platform publishing connectors, or full desktop packaging.
- Do not make UI polish a V3 phase unless it is required for advanced intelligence inspection or approval.
- Do not add living-author imitation, copyrighted passage reuse, or silent agent canon changes.
- Do not replace SQLite, Drizzle, Fastify, React, Vite, or TypeScript.

## Architecture Impact

- `packages/retrieval` becomes an evaluated retrieval engine with embedding storage, ranking, compression, negative memory, policy scoring, and regression snapshots.
- `packages/domain/src/narrative` gains extraction and validation engines rather than simple helpers only.
- `packages/db` gains first-class persistence for narrative facts, version history, semantic diffs, retrieval evaluation snapshots, similarity audits, review lifecycle, serialization signals, branch/retcon/regression records, scheduled backups, and migration history.
- `packages/workflow` gains advanced jobs for extraction, regression recheck, branch simulation, retcon proposals, review learning, serialization recommendation, backup scheduling, and evaluation runs.
- `apps/api` exposes inspectable and approval-aware endpoints for advanced engines.
- `apps/web` adds product surfaces only where authors need to inspect, approve, compare, restore, or understand risk.

## File Structure and Ownership

### Retrieval and Evaluation

- Modify `packages/retrieval/src/vector-store.ts`
- Create `packages/retrieval/src/sqlite-vector-store.ts`
- Create `packages/retrieval/src/reranker.ts`
- Create `packages/retrieval/src/context-compressor.ts`
- Create `packages/retrieval/src/scoring.ts`
- Create `packages/retrieval/src/retrieval-evaluation.ts`
- Modify `packages/retrieval/src/context-builder.ts`, `retrieval-policy.ts`, `index.ts`
- Modify `packages/evaluation/src/evaluation-case.ts`, `evaluation-runner.ts`
- Create tests under `packages/retrieval/src/*.test.ts` and update evaluation tests.

### Narrative Intelligence

- Modify or create files in `packages/domain/src/narrative`:
  - `promises.ts`, `promise-extraction.ts`, `promise-payoff.ts`
  - `secrets.ts`, `secret-leak.ts`, `reveal-planner.ts`
  - `arcs.ts`, `arc-extraction.ts`, `relationship-consistency.ts`
  - `timeline.ts`, `timeline-consistency.ts`, `location-consistency.ts`
  - `rules.ts`, `world-rule-validation.ts`
  - `dependencies.ts`, `impact.ts`, `retcon.ts`, `regression.ts`, `branches.ts`, `closure.ts`
- Create matching tests for every engine.

### Governance and Safety

- Create `packages/domain/src/safety/similarity-guard.ts`
- Create `packages/domain/src/safety/source-policy-enforcement.ts`
- Create `packages/domain/src/safety/authorship-audit.ts`
- Modify `packages/domain/src/memory/canon.ts`, `approvals.ts`
- Modify `packages/workflow/src/authorship.ts`, `copilot-runtime.ts`
- Create tests under `packages/domain/src/safety` and update workflow tests.

### Review, Serialization, Versioning, Observability

- Modify `packages/domain/src/review/review.ts`
- Create `packages/domain/src/review/review-learning.ts`
- Modify `packages/domain/src/serialization/serialization.ts`
- Create `packages/domain/src/serialization/platform-profile.ts`
- Create `packages/domain/src/serialization/recommendations.ts`
- Create `packages/domain/src/versioning/version-history.ts`
- Create `packages/domain/src/versioning/semantic-diff.ts`
- Modify `packages/evaluation/src/observability.ts`
- Create tests under matching package paths.

### DB and API

- Modify `packages/db/src/schema.ts`, `migrate.ts`, `check.ts`, `index.ts`
- Create repositories:
  - `embedding.repository.ts`
  - `narrative-state.repository.ts`
  - `governance.repository.ts`
  - `review-learning.repository.ts`
  - `serialization-intelligence.repository.ts`
  - `branch-retcon.repository.ts`
  - `version-history.repository.ts`
  - `observability.repository.ts`
  - `migration-history.repository.ts`
  - `scheduled-backup.repository.ts`
- Create API routes:
  - `retrieval.routes.ts`
  - `narrative-intelligence.routes.ts`
  - `governance.routes.ts`
  - `review-learning.routes.ts`
  - `serialization-intelligence.routes.ts`
  - `branch-retcon.routes.ts`
  - `version-history.routes.ts`
  - `observability.routes.ts`
  - `migration.routes.ts`
  - `scheduled-backup.routes.ts`
- Add tests under `apps/api/src/test`.

### Web and E2E

- Create components:
  - `RetrievalEvaluationPanel.tsx`
  - `NarrativeIntelligencePanel.tsx`
  - `GovernanceAuditPanel.tsx`
  - `ReviewLearningPanel.tsx`
  - `SerializationIntelligencePanel.tsx`
  - `BranchRetconPanel.tsx`
  - `VersionHistoryPanel.tsx`
  - `SemanticDiffViewer.tsx`
  - `ProductObservabilityDashboard.tsx`
  - `ScheduledBackupPanel.tsx`
- Modify existing panels only to wire data and navigation.
- Create E2E specs for retrieval evaluation, narrative governance, branch/retcon, version restore, and observability dashboards.

## TDD and Verification Protocol

- Every module starts with a failing test.
- The failing test must be run and recorded before implementation unless an equivalent test already exists.
- Each stage runs narrow tests, package tests, DB check, and at least one API/UI test when the stage has API/UI surfaces.
- Each stage ends with commit and push.
- Any test failure uses `superpowers:systematic-debugging`.
- Before declaring a stage complete, use `superpowers:verification-before-completion`.
- After major stages, use `superpowers:requesting-code-review`.
- Work is delegated to subagents whenever write scopes do not conflict. Every delegated prompt must contain `Delegated subagent task`.
- Test snippets in this plan use local helpers such as `*Fixture`, `mock*Client`, and fake stores; create those helpers inside the same test file during the failing-test step.

## Stage V3-1: Advanced Retrieval Intelligence

**Design coverage:** Retrieval pipeline lines 1058-1126, storage vector rules lines 362 and 376, implementation defaults lines 1308 and 1552, evaluation lines 1120-1126.

**Files:**

- Modify `packages/retrieval/src/vector-store.ts`
- Create `packages/retrieval/src/sqlite-vector-store.ts`
- Create `packages/retrieval/src/reranker.ts`
- Create `packages/retrieval/src/context-compressor.ts`
- Create `packages/retrieval/src/scoring.ts`
- Create `packages/retrieval/src/retrieval-evaluation.ts`
- Modify `packages/retrieval/src/context-builder.ts`, `retrieval-policy.ts`
- Create `packages/db/src/repositories/embedding.repository.ts`
- Modify `packages/db/src/schema.ts`, `migrate.ts`, `check.ts`
- Modify `packages/evaluation/src/evaluation-case.ts`, `evaluation-runner.ts`
- Create `apps/api/src/routes/retrieval.routes.ts`
- Create `apps/web/src/components/RetrievalEvaluationPanel.tsx`

**Task V3-1A: SQLite Local Vector Store**

Expected failing test:

```ts
// packages/retrieval/src/sqlite-vector-store.test.ts
it('persists embedding records with model and version and returns nearest references without making vectors the source of truth', async () => {
  const store = createSqliteVectorStore(db);
  await store.upsert({ id: 'emb_1', sourceId: 'canon_1', model: 'text-embedding-test', modelVersion: '2026-04-27', vector: [1, 0, 0] });
  await store.upsert({ id: 'emb_2', sourceId: 'canon_2', model: 'text-embedding-test', modelVersion: '2026-04-27', vector: [0, 1, 0] });

  const results = await store.search([0.9, 0.1, 0], 1);
  expect(results).toEqual([{ sourceId: 'canon_1', score: expect.any(Number) }]);
});
```

Expected first failure: `createSqliteVectorStore` is not exported.

Steps:

- [ ] Add embedding domain/storage types with source id, model, version, and vector hash.
- [ ] Add DB table and repository.
- [ ] Implement cosine similarity in local SQLite-backed adapter.
- [ ] Keep source records outside vector table and assert only references are returned.
- [ ] Run narrow tests.

**Task V3-1B: Reranking, Budget Compression, Negative Memory, and Source Scoring**

Expected failing test:

```ts
// packages/retrieval/src/reranker.test.ts
it('ranks canon and recent authoritative memories above stale draft memories while excluding negative memory and restricted samples', () => {
  const ranked = rerankRetrievalItems(retrievalRankingFixture(), {
    sourcePolicy: 'generation',
    maxItems: 4,
    currentChapter: 42
  });

  expect(ranked.included.map((item) => item.id)).toEqual(['canon_recent', 'promise_ready', 'licensed_sample']);
  expect(ranked.excluded.map((item) => item.reason)).toContain('negative_memory');
  expect(ranked.excluded.map((item) => item.reason)).toContain('source_policy');
});
```

Expected first failure: `rerankRetrievalItems` is not exported.

Steps:

- [ ] Add scoring functions for status, recency, authority, source policy, promise strength, dependency risk, and evidence quality.
- [ ] Add negative memory exclusion before context assembly.
- [ ] Add context compression that preserves must-have constraints and citations.
- [ ] Add retrieval trace entries for every exclusion and compression action.

**Task V3-1C: Retrieval Regression Suite**

Expected failing test:

```ts
// packages/retrieval/src/retrieval-evaluation.test.ts
it('fails a retrieval policy regression when a must-have canon fact is not recalled or a forbidden sample is included', async () => {
  const result = await runRetrievalEvaluationCase(retrievalCaseWithForbiddenSample(), retrievalCandidateThatMissesCanon());

  expect(result.status).toBe('Failed');
  expect(result.failures).toEqual(['missing:canon_bell_alive', 'forbidden:sample_restricted']);
});
```

Expected first failure: `runRetrievalEvaluationCase` is not exported.

Steps:

- [ ] Extend evaluation cases for retrieval-specific must-include and must-exclude assertions.
- [ ] Add snapshot output that records query, policy version, model, embedding model, included ids, excluded ids, and failures.
- [ ] Add API and UI panel to run and inspect retrieval evaluations.

**Verification commands:**

```bash
npm test -- packages/retrieval
npm test -- packages/evaluation
npm test -- packages/db/src/test/embedding.repository.test.ts
npm test -- apps/api/src/test/retrieval.routes.test.ts
npm test -- apps/web/src/test/retrieval-evaluation-panel.test.tsx
npm run db:check
```

**Commit boundary:** `feat: add advanced retrieval intelligence`

## Stage V3-2: Narrative Intelligence Engines

**Design coverage:** Promises lines 432-572, secrets lines 573-610, arcs lines 611-640, timeline lines 642-670, world rules lines 672-702, dependency/closure lines 704-816.

**Files:**

- Create and modify narrative engine files listed in the Narrative Intelligence ownership section.
- Create `packages/db/src/repositories/narrative-state.repository.ts`
- Create `apps/api/src/routes/narrative-intelligence.routes.ts`
- Create `apps/web/src/components/NarrativeIntelligencePanel.tsx`

**Task V3-2A: Promise Detection, Payoff Recommendation, and Reader Promise Tracking**

Expected failing test:

```ts
// packages/domain/src/narrative/promise-extraction.test.ts
it('extracts a high-confidence core promise from text and routes it to confirmation instead of silently activating it', () => {
  const result = detectReaderPromises({ chapter: 12, text: 'The sealed bell will answer why the city floats.', entities: ['bell', 'city'] });

  expect(result.candidates[0]).toMatchObject({ strength: 'Core', status: 'Candidate', confirmation: 'DecisionQueue' });
});
```

Expected first failure: `detectReaderPromises` is not exported.

Expected payoff test:

```ts
// packages/domain/src/narrative/promise-payoff.test.ts
it('recommends reinforce, payoff, transform, delay, or abandon actions with evidence and false-positive tolerance', () => {
  const recommendation = recommendPayoffAction(corePromiseNearWindow(), currentChapterWithRelatedEntities());

  expect(recommendation.action).toBe('TruePayoff');
  expect(recommendation.evidence).toHaveLength(2);
});
```

Steps:

- [ ] Add candidate confidence tiers: silent pool, summary, confirmation list, decision queue.
- [ ] Add user actions: confirm, not a promise, merge, raise/lower importance, long-range, pay off now, remind later, park, abandon.
- [ ] Add payoff quality checks for early, late, too-small, too-large, unsupported, or conflicting payoff.

**Task V3-2B: Secret Leak Detection and Reveal Planning**

Expected failing test:

```ts
// packages/domain/src/narrative/secret-leak.test.ts
it('detects when a character uses a secret before their knowledge state allows it and recommends a reveal plan change', () => {
  const result = detectSecretLeaks(secretSceneFixture());

  expect(result.leaks[0]).toMatchObject({ secretId: 'secret_bell_alive', characterId: 'scout', severity: 'High' });
  expect(result.recommendations[0].type).toBe('MoveRevealEarlierOrChangeSpeaker');
});
```

Expected first failure: `detectSecretLeaks` is not exported.

Steps:

- [ ] Add misinformation and knowledge-state facts.
- [ ] Validate reader knowledge separately from character knowledge.
- [ ] Add reveal timing validation and recommendations.
- [ ] Add serialization-retention warning for high-value secrets.

**Task V3-2C: Character Arc and Relationship Extraction**

Expected failing test:

```ts
// packages/domain/src/narrative/arc-extraction.test.ts
it('extracts motivation, belief, relationship turn, and arc stage from accepted text and flags unearned relationship jumps', () => {
  const result = extractCharacterArcFacts(acceptedTextWithRelationshipJump());

  expect(result.facts.some((fact) => fact.type === 'MotivationState')).toBe(true);
  expect(result.conflicts[0]).toMatchObject({ type: 'UnearnedRelationshipShift', severity: 'Medium' });
});
```

Expected first failure: `extractCharacterArcFacts` is not exported.

Steps:

- [ ] Add motivation and belief extraction.
- [ ] Add relationship turning point requirements.
- [ ] Add consistency checks for loyalty, debt, intimacy, rivalry, and earned turns.

**Task V3-2D: Timeline, Location, Causality, World Rule, and Power Validation**

Expected failing test:

```ts
// packages/domain/src/narrative/timeline-consistency.test.ts
it('detects impossible travel, deadline misses, concurrent event conflicts, and downstream causality errors', () => {
  const result = validateTimelineConsistency(timelineConflictFixture());

  expect(result.violations.map((violation) => violation.type)).toEqual([
    'ImpossibleTravel',
    'DeadlineMissed',
    'ConcurrentConflict',
    'CausalityOrder'
  ]);
});
```

Expected world rule test:

```ts
// packages/domain/src/narrative/world-rule-validation.test.ts
it('rejects power use when cost, cooldown, resource, or counter-rule constraints are missing', () => {
  const result = validateWorldRuleUse(powerUseWithoutCostFixture());

  expect(result.accepted).toBe(false);
  expect(result.violations[0].type).toBe('MissingAbilityCost');
});
```

Steps:

- [ ] Add location distance and travel duration rules.
- [ ] Add deadline and concurrency validation.
- [ ] Add world rule cost, limit, cooldown, exception, counter-rule, and progression validation.
- [ ] Add false-positive flags and confidence on extracted violations.

**Task V3-2E: Ending Closure and Final Payoff Engine**

Expected failing test:

```ts
// packages/domain/src/narrative/closure.test.ts
it('builds an ending closure plan across plot, character arcs, promises, secrets, world state, antagonist outcome, and reader contract', () => {
  const plan = createFinalPayoffPlan(finalVolumeClosureFixture());

  expect(plan.items.map((item) => item.sourceType)).toEqual([
    'Plotline',
    'CharacterArc',
    'ReaderPromise',
    'Secret',
    'WorldRule',
    'AntagonistOutcome',
    'ReaderContract'
  ]);
  expect(plan.blockers[0]).toMatchObject({ type: 'UnresolvedCorePromise', severity: 'Blocking' });
});
```

Expected first failure: `createFinalPayoffPlan` is not exported.

Expected trigger test:

```ts
// packages/domain/src/narrative/closure.test.ts
it('activates ending closure checks when final volume is selected or major arcs approach resolution', () => {
  const result = shouldRunClosureChecks(projectNearFinalArcFixture());

  expect(result.run).toBe(true);
  expect(result.reason).toBe('MajorArcsApproachingResolution');
});
```

Expected first failure: `shouldRunClosureChecks` is not exported.

Steps:

- [ ] Add final payoff plan model for plotlines, major character arcs, core reader promises, secrets/reveals, world-state outcomes, antagonist outcomes, epilogue/open-question decisions, and reader-contract satisfaction.
- [ ] Add activation rules for final volume, explicit ending-planning request, and approaching major-arc resolution.
- [ ] Add closure blockers and recommendations for unresolved core promises, unsupported secret reveals, broken world-state consequences, and missing antagonist outcomes.
- [ ] Feed closure items into review, serialization readiness, branch/retcon regression, and Version History trace links.
- [ ] Expose closure findings through the narrative intelligence API and panel, not as a separate V2 workspace.

**Verification commands:**

```bash
npm test -- packages/domain/src/narrative
npm test -- packages/db/src/test/narrative-state.repository.test.ts
npm test -- apps/api/src/test/narrative-intelligence.routes.test.ts
npm test -- apps/web/src/test/narrative-intelligence-panel.test.tsx
```

**Commit boundary:** `feat: add narrative intelligence engines`

## Stage V3-3: Governance and Safety

**Design coverage:** Governance layer lines 85-99, safety/rights lines 1451-1462, SourcePolicy lines 311-332, authorship control lines 888-952, high-risk runtime events lines 879-886.

**Files:**

- Create `packages/domain/src/safety/similarity-guard.ts`
- Create `packages/domain/src/safety/source-policy-enforcement.ts`
- Create `packages/domain/src/safety/authorship-audit.ts`
- Modify `packages/domain/src/memory/canon.ts`, `approvals.ts`
- Modify `packages/workflow/src/authorship.ts`, `copilot-runtime.ts`, `writing-workflow.ts`
- Create `packages/db/src/repositories/governance.repository.ts`
- Create `apps/api/src/routes/governance.routes.ts`
- Create `apps/web/src/components/GovernanceAuditPanel.tsx`

**Expected failing tests:**

```ts
// packages/domain/src/safety/similarity-guard.test.ts
it('blocks generated prose that crosses similarity threshold against protected samples and records evidence without storing the protected text', () => {
  const result = checkSimilarityRisk(generatedDraft(), protectedSampleHashes());

  expect(result.status).toBe('Blocked');
  expect(result.evidence[0]).toMatchObject({ sampleId: 'sample_protected', similarity: expect.any(Number) });
  expect(JSON.stringify(result)).not.toContain('protected paragraph text');
});
```

Expected first failure: `checkSimilarityRisk` is not exported.

```ts
// packages/domain/src/safety/source-policy-enforcement.test.ts
it('turns source-policy violations, canon conflicts, and high-authorship changes into approval requests', () => {
  const result = enforceGovernance(generationWithPolicyViolation());

  expect(result.approvals.map((approval) => approval.targetType)).toEqual(['SourcePolicyViolation', 'CanonConflict', 'AuthorshipControl']);
});
```

Expected first failure: `enforceGovernance` is not exported.

```ts
// packages/domain/src/safety/authorship-audit.test.ts
it('records authorship level, contract, accepted fragments, rejected fragments, and user decision trail', () => {
  const audit = createAuthorshipAuditTrail(authorshipDecisionFixture());

  expect(audit.events.map((event) => event.type)).toEqual(['ContractCreated', 'DraftGenerated', 'FragmentAccepted', 'FragmentRejected']);
});
```

Expected first failure: `createAuthorshipAuditTrail` is not exported.

**Implementation steps:**

- [ ] Add similarity guard with configurable thresholds and protected-sample references.
- [ ] Add source-policy enforcement gate before generation context and after generated output.
- [ ] Add canon conflict escalation and approval request creation.
- [ ] Add authorship audit trail that records user decisions and accepted/rejected fragments.
- [ ] Expose governance audit API and UI.

**Verification commands:**

```bash
npm test -- packages/domain/src/safety
npm test -- packages/workflow/src/authorship.test.ts packages/workflow/src/writing-workflow.test.ts
npm test -- packages/db/src/test/governance.repository.test.ts
npm test -- apps/api/src/test/governance.routes.test.ts
npm test -- apps/web/src/test/governance-audit-panel.test.tsx
```

**Commit boundary:** `feat: add governance and safety gates`

## Stage V3-4: Review Learning and Revision Intelligence

**Design coverage:** Review and Revision lines 1175-1254, review workflow lines 1035-1045, observability outcomes lines 1393-1406.

**Files:**

- Modify `packages/domain/src/review/review.ts`
- Create `packages/domain/src/review/review-learning.ts`
- Modify `packages/workflow/src/review-workflow.ts`
- Create `packages/db/src/repositories/review-learning.repository.ts`
- Create `apps/api/src/routes/review-learning.routes.ts`
- Create `apps/web/src/components/ReviewLearningPanel.tsx`

**Expected failing tests:**

```ts
// packages/domain/src/review/review-learning.test.ts
it('moves review findings through false-positive, accepted, rejected, resolved, and regression states', () => {
  const finding = createReviewFindingLifecycle(reviewFindingFixture());
  const resolved = transitionReviewFinding(transitionReviewFinding(transitionReviewFinding(finding, 'Accepted'), 'Resolved'), 'Regression');

  expect(resolved.status).toBe('Regression');
  expect(resolved.history.map((event) => event.to)).toEqual(['Accepted', 'Resolved', 'Regression']);
});
```

Expected first failure: `createReviewFindingLifecycle` is not exported.

```ts
// packages/domain/src/review/review-learning.test.ts
it('aggregates recurring issues and quality trends from accepted and rejected review findings', () => {
  const trends = calculateQualityTrends(reviewHistoryFixture());

  expect(trends.recurringIssues[0]).toMatchObject({ category: 'continuity', count: 3 });
  expect(trends.scores.continuity.direction).toBe('Improving');
});
```

Expected first failure: `calculateQualityTrends` is not exported.

```ts
// packages/workflow/src/review-workflow.test.ts
it('rechecks affected findings after manuscript changes and marks resolved or regression with evidence', async () => {
  const result = await recheckReviewFindingsAfterRevision(revisionRecheckFixture());

  expect(result.updatedFindings.map((finding) => finding.status)).toEqual(['Resolved', 'Regression']);
});
```

Expected first failure: `recheckReviewFindingsAfterRevision` is not exported.

**Implementation steps:**

- [ ] Add review finding lifecycle and history.
- [ ] Add false-positive records and user preference learning.
- [ ] Add recurring issue detection by category, target, pattern, and repeated fix.
- [ ] Add quality trend tracking for continuity, character, timeline, world-rule, reveal, pacing, promise, hook, style, and reader contract.
- [ ] Add revision recheck workflow after manuscript changes.
- [ ] Add API and UI for review learning.

**Verification commands:**

```bash
npm test -- packages/domain/src/review
npm test -- packages/workflow/src/review-workflow.test.ts
npm test -- packages/db/src/test/review-learning.repository.test.ts
npm test -- apps/api/src/test/review-learning.routes.test.ts
npm test -- apps/web/src/test/review-learning-panel.test.tsx
```

**Commit boundary:** `feat: add review learning and revision intelligence`

## Stage V3-5: Serialization Intelligence

**Design coverage:** Serialization workflow lines 1047-1057, Serialization System lines 1255-1295, short-term feedback rule lines 1294-1295, project goals lines 334-356.

**Files:**

- Modify `packages/domain/src/serialization/serialization.ts`
- Create `packages/domain/src/serialization/platform-profile.ts`
- Create `packages/domain/src/serialization/recommendations.ts`
- Modify `packages/workflow/src/serialization-workflow.ts` or create it if absent.
- Create `packages/db/src/repositories/serialization-intelligence.repository.ts`
- Create `apps/api/src/routes/serialization-intelligence.routes.ts`
- Create `apps/web/src/components/SerializationIntelligencePanel.tsx`

**Expected failing tests:**

```ts
// packages/domain/src/serialization/platform-profile.test.ts
it('applies platform profile rules to title length, update cadence, chapter length, hooks, and prohibited release states', () => {
  const result = validatePlatformProfile(serializationPlanFixture(), platformProfileFixture());

  expect(result.violations.map((violation) => violation.type)).toEqual(['TitleTooLong', 'BufferRisk', 'WeakEndingHook']);
});
```

Expected first failure: `validatePlatformProfile` is not exported.

```ts
// packages/domain/src/serialization/recommendations.test.ts
it('generates title, hook, recap, cliffhanger, churn, feedback strategy, burnout, and pacing recommendations from real signals', () => {
  const result = recommendSerializationActions(serializationSignalFixture());

  expect(result.titleVariants).toHaveLength(3);
  expect(result.risks.map((risk) => risk.type)).toContain('ChurnSignal');
  expect(result.warnings.map((warning) => warning.type)).toContain('BurnoutRisk');
});
```

Expected first failure: `recommendSerializationActions` is not exported.

**Implementation steps:**

- [ ] Add platform profile rules and validation.
- [ ] Add recommendation contracts for title, hook, recap, cliffhanger, and next-chapter strategy.
- [ ] Add churn signal calculations from reader feedback, promise aging, confusion, complaint recurrence, hook trend, and buffer risk.
- [ ] Add burnout guard and pacing warnings.
- [ ] Preserve rule that short-term feedback cannot override long-term structure without explicit approval.

**Verification commands:**

```bash
npm test -- packages/domain/src/serialization
npm test -- packages/db/src/test/serialization-intelligence.repository.test.ts
npm test -- apps/api/src/test/serialization-intelligence.routes.test.ts
npm test -- apps/web/src/test/serialization-intelligence-panel.test.tsx
```

**Commit boundary:** `feat: add serialization intelligence`

## Stage V3-6: Branch, Retcon, and Regression Automation

**Design coverage:** Narrative dependency index lines 704-728, Change Impact/Retcon/Regression lines 730-758, Branch Sandbox lines 759-785, storage invariants lines 380-381.

**Files:**

- Modify `packages/domain/src/narrative/dependencies.ts`, `impact.ts`, `branches.ts`
- Create `packages/domain/src/narrative/retcon.ts`
- Create `packages/domain/src/narrative/regression.ts`
- Modify `packages/workflow/src/branch-retcon-workflow.ts` or create it.
- Create `packages/db/src/repositories/branch-retcon.repository.ts`
- Create `apps/api/src/routes/branch-retcon.routes.ts`
- Create `apps/web/src/components/BranchRetconPanel.tsx`

**Expected failing tests:**

```ts
// packages/domain/src/narrative/retcon.test.ts
it('creates a retcon proposal with impact report, before/after diff, regression checks, and approval gate before manuscript changes', () => {
  const proposal = createRetconProposal(retconFixture());

  expect(proposal.impactReport.affected.chapters).toContain('chapter_12');
  expect(proposal.regressionChecks.map((check) => check.scope)).toEqual(['canon', 'manuscript', 'timeline', 'promise', 'secret', 'world_rule']);
  expect(proposal.approval.status).toBe('Pending');
});
```

Expected first failure: `createRetconProposal` is not exported.

```ts
// packages/domain/src/narrative/regression.test.ts
it('blocks branch adoption when regression checks fail across canon, manuscript, timeline, promise, secret, or world-rule state', () => {
  const result = runNarrativeRegressionChecks(branchAdoptionFixtureWithFailures());

  expect(result.status).toBe('Blocked');
  expect(result.failures.map((failure) => failure.scope)).toEqual(['canon', 'timeline', 'secret']);
});
```

Expected first failure: `runNarrativeRegressionChecks` is not exported.

```tsx
// apps/web/src/test/branch-retcon-panel.test.tsx
it('shows branch sandbox impact map and keeps branch artifacts isolated until explicit adoption', async () => {
  render(<BranchRetconPanel client={mockBranchRetconClient()} />);

  expect(await screen.findByText('Impact map')).toBeInTheDocument();
  expect(screen.getByText('Isolated branch artifact')).toBeInTheDocument();
});
```

Expected first failure: `BranchRetconPanel` does not exist.

**Implementation steps:**

- [ ] Add branch sandbox visual impact data model.
- [ ] Add retcon proposal workflow with impact report and regression checks.
- [ ] Add before/after diff records.
- [ ] Add adoption gate and partial adoption handling.
- [ ] Ensure branch artifacts remain isolated until approved.

**Verification commands:**

```bash
npm test -- packages/domain/src/narrative/branches.test.ts packages/domain/src/narrative/retcon.test.ts packages/domain/src/narrative/regression.test.ts packages/domain/src/narrative/impact.test.ts
npm test -- packages/db/src/test/branch-retcon.repository.test.ts
npm test -- apps/api/src/test/branch-retcon.routes.test.ts
npm test -- apps/web/src/test/branch-retcon-panel.test.tsx
```

**Commit boundary:** `feat: add branch retcon regression automation`

## Stage V3-7: Version History and Diff System

**Design coverage:** Version History screen line 114, storage rules lines 357-381, artifact versioning lines 360-361, AgentRun trace lines 287-300, retcon accepted version rule line 756.

**Files:**

- Create `packages/domain/src/versioning/version-history.ts`
- Create `packages/domain/src/versioning/semantic-diff.ts`
- Modify `packages/domain/src/artifact/artifact.ts`, `agents/agent-run.ts`, `agents/context-pack.ts`, `memory/canon.ts`
- Create `packages/db/src/repositories/version-history.repository.ts`
- Create `apps/api/src/routes/version-history.routes.ts`
- Create `apps/web/src/components/VersionHistoryPanel.tsx`
- Create `apps/web/src/components/SemanticDiffViewer.tsx`

**Expected failing tests:**

```ts
// packages/domain/src/versioning/version-history.test.ts
it('creates traceable versions across manuscript, canon, prompt, run, context pack, and artifact entities', () => {
  const history = createVersionHistory(versionHistoryFixture());

  expect(history.entities.map((entity) => entity.type)).toEqual(['manuscript', 'canon', 'prompt', 'run', 'context_pack', 'artifact']);
  expect(history.trace.links).toContainEqual({ from: 'run_1', to: 'context_pack_1', relation: 'used_context' });
});
```

Expected first failure: `createVersionHistory` is not exported.

```ts
// packages/domain/src/versioning/semantic-diff.test.ts
it('diffs narrative state semantically and restores a prior version without breaking cross-entity traceability', () => {
  const diff = diffNarrativeState(beforeNarrativeState(), afterNarrativeState());
  const restored = restoreVersion(afterNarrativeState(), diff.restorePoint);

  expect(diff.changes.map((change) => change.type)).toEqual(['CanonChanged', 'PromisePayoffMoved', 'SecretRevealDelayed']);
  expect(restored.traceability.parentVersionId).toBe('narrative_state_before');
});
```

Expected first failure: `diffNarrativeState` is not exported.

```tsx
// apps/web/src/test/version-history-panel.test.tsx
it('compares and restores manuscript, canon, prompt, run, context pack, and artifact versions', async () => {
  render(<VersionHistoryPanel client={mockVersionHistoryClient()} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Compare selected' }));

  expect(screen.getByText('Semantic diff')).toBeInTheDocument();
});
```

Expected first failure: `VersionHistoryPanel` does not exist.

**Implementation steps:**

- [ ] Add version history domain entities and cross-entity trace links.
- [ ] Add semantic diff for narrative state changes.
- [ ] Add restore operation with audit trail and approval gate for high-risk restores.
- [ ] Add compare API and UI.
- [ ] Add restore API and UI with preflight regression checks.

**Verification commands:**

```bash
npm test -- packages/domain/src/versioning
npm test -- packages/db/src/test/version-history.repository.test.ts
npm test -- apps/api/src/test/version-history.routes.test.ts
npm test -- apps/web/src/test/version-history-panel.test.tsx
```

**Commit boundary:** `feat: add version history and semantic diff`

## Stage V3-8: Observability and Productization

**Design coverage:** Observability lines 1393-1406, durable jobs lines 1371-1391, import/export/backup lines 1408-1449, product positioning extension boundaries lines 23-34, implementation defaults lines 1545-1554.

**Files:**

- Modify `packages/evaluation/src/observability.ts`, `evaluation-runner.ts`
- Create `packages/workflow/src/scheduled-backup.ts`
- Create `packages/db/src/repositories/observability.repository.ts`
- Create `packages/db/src/repositories/migration-history.repository.ts`
- Create `packages/db/src/repositories/scheduled-backup.repository.ts`
- Modify `packages/db/src/check.ts`, `migrate.ts`
- Create `apps/api/src/routes/observability.routes.ts`
- Create `apps/api/src/routes/migration.routes.ts`
- Create `apps/api/src/routes/scheduled-backup.routes.ts`
- Create `apps/web/src/components/ProductObservabilityDashboard.tsx`
- Create `apps/web/src/components/ScheduledBackupPanel.tsx`
- Create `docs/superpowers/spikes/2026-04-27-local-desktop-packaging-feasibility.md`

**Expected failing tests:**

```ts
// packages/evaluation/src/observability.test.ts
it('aggregates cost, latency, token, quality, retry, failure, context length, and adoption metrics from real agent run data', () => {
  const summary = aggregateProductObservability(realRunMetricsFixture());

  expect(summary.cost.totalUsd).toBeGreaterThan(0);
  expect(summary.latency.p95Ms).toBeGreaterThan(0);
  expect(summary.quality.userAdoption.adopted).toBe(2);
});
```

Expected first failure: `aggregateProductObservability` is not exported.

```ts
// packages/workflow/src/scheduled-backup.test.ts
it('creates scheduled backup jobs, records last success, and refuses overlapping backup runs for the same project', async () => {
  const result = await runScheduledBackup(scheduledBackupFixture());

  expect(result.job.status).toBe('Succeeded');
  expect(result.nextRunAt).toBe('2026-04-28T00:00:00.000Z');
});
```

Expected first failure: `runScheduledBackup` is not exported.

```ts
// packages/db/src/test/migration-history.repository.test.ts
it('records migration id, checksum, applied timestamp, and verification status for local database management', async () => {
  await repository.recordMigration({ id: '20260427_v3', checksum: 'abc123', status: 'Verified' });

  expect(await repository.list()).toContainEqual(expect.objectContaining({ id: '20260427_v3', status: 'Verified' }));
});
```

Expected first failure: repository does not exist.

```tsx
// apps/web/src/test/product-observability-dashboard.test.tsx
it('renders real cost, latency, token, quality, backup, and migration health metrics from the API', async () => {
  render(<ProductObservabilityDashboard client={mockObservabilityClient()} />);

  expect(await screen.findByText('Cost')).toBeInTheDocument();
  expect(screen.getByText('Migration health')).toBeInTheDocument();
});
```

Expected first failure: component does not exist.

**Implementation steps:**

- [ ] Aggregate metrics from persisted AgentRun, LLM logs, WorkflowRun, ContextPack, evaluation, and user adoption records.
- [ ] Add observability API and dashboard over real data.
- [ ] Add scheduled backup workflow with non-overlap guard and restore verification.
- [ ] Add migration history repository and DB check integration.
- [ ] Write desktop packaging feasibility spike limited to design-permitted local Web workspace extension boundary.

**Verification commands:**

```bash
npm test -- packages/evaluation
npm test -- packages/workflow/src/scheduled-backup.test.ts
npm test -- packages/db/src/test/observability.repository.test.ts packages/db/src/test/migration-history.repository.test.ts packages/db/src/test/scheduled-backup.repository.test.ts
npm test -- apps/api/src/test/observability.routes.test.ts apps/api/src/test/migration.routes.test.ts apps/api/src/test/scheduled-backup.routes.test.ts
npm test -- apps/web/src/test/product-observability-dashboard.test.tsx apps/web/src/test/scheduled-backup-panel.test.tsx
npm run db:check
```

**Commit boundary:** `feat: add observability productization and backup scheduling`

## V3 Final Completion Gate

Run before declaring V3 complete:

```bash
npm test
npm run build
npm run db:check
npm run test:e2e
git status --short
```

Browser check:

- Project workspace opens without console-blocking errors.
- Retrieval evaluation panel runs a regression suite and displays pass/fail details.
- Narrative intelligence panel shows extracted promise, secret, arc, timeline, and world-rule findings with evidence.
- Governance audit panel shows similarity/source/canon/authorship gates.
- Review learning panel shows lifecycle and recurring issue trends.
- Serialization intelligence panel shows platform profile and recommendation outputs.
- Branch/retcon panel shows isolated branch impact and regression status.
- Version history panel compares and restores versions with semantic diff.
- Product observability dashboard shows real metrics and scheduled backup state.

Commit and push:

```bash
git add .
git commit -m "test: verify v3 intelligence and productization"
git push
```

## V3 Coverage Matrix

| V3 requirement | Design anchor | Stage |
| --- | --- | --- |
| Embeddings/vector store abstraction and SQLite local persistence | Storage 362, 376; Retrieval 1101; Defaults 1308, 1552 | V3-1A |
| Retrieval reranking, compression, negative memory, recency/authority/source-policy scoring | Retrieval 1098-1115 | V3-1B |
| Retrieval evaluation regression suite | Retrieval evaluation 1120-1126 | V3-1C |
| Promise detection, payoff recommendation, reader promise tracking | Promises 432-572 | V3-2A |
| Secret leak detection, reveal planning, reveal timing validation | Secrets 573-610 | V3-2B |
| Character arc and relationship extraction/consistency | Arcs 611-640 | V3-2C |
| Timeline/location/causality consistency | Timeline 642-670 | V3-2D |
| World rule/power/constraint validation | World Rules 672-702 | V3-2D |
| Ending closure and final payoff planning | Ending/Closure 787-816; Acceptance 1569 | V3-2E |
| Similarity guard | Knowledge/style safety 1160-1164; Safety 1451-1462 | V3-3 |
| Rights/safety/source-policy enforcement | SourcePolicy 311-332; Safety 1451-1462 | V3-3 |
| Canon conflict escalation | Governance 85-99; Runtime risks 879-886 | V3-3 |
| Authorship control audit trail | Authorship 888-952 | V3-3 |
| Review finding lifecycle and recurring issue detection | Review learning 1234-1254 | V3-4 |
| Quality trend tracking and revision recheck | Review 1035-1045; Quality trends 1240-1254 | V3-4 |
| Platform profile, title/hook/recap/cliffhanger, churn, feedback, burnout, pacing | Serialization 1255-1295 | V3-5 |
| Branch sandbox visual impact map | Branch Sandbox 759-785 | V3-6 |
| Retcon proposal and regression across narrative systems | Impact/Retcon 730-758 | V3-6 |
| Version history across manuscript/canon/prompt/run/context/artifact | Version History 114; AgentRun 287-300; Storage 360-361 | V3-7 |
| Semantic narrative diff, restore, compare, traceability | Storage 357-381; Retcon versioning 756 | V3-7 |
| Observability dashboards, cost/latency/token/quality metrics | Observability 1393-1406 | V3-8 |
| Backup scheduling | Durable jobs 1371-1391; Backup 1408-1449 | V3-8 |
| Migration management | Storage/migration defaults 357-381, 1545-1554 | V3-8 |
| Electron/Tauri feasibility spike if permitted | Product positioning extension boundary 23-34 | V3-8 |

## V2 / V3 / Deferred Boundary

V2 already provides:

- Real provider boundary, API-backed writing workflows, manuscript CRUD/versioning, editor acceptance, Agent Room, decision queue, memory extraction, canon/retrieval workflows, settings, global search, import/export/backup UI, and verification gates.

V3 provides:

- Advanced intelligence, productized governance, regression automation, version/diff/restore, observability dashboards, backup scheduling, migration management, and desktop feasibility spike.

Deferred beyond V3:

- External platform connectors: design treats them as extension modules behind import interfaces.
- Cloud sync, collaboration, plugin marketplace: outside current local-first boundary.
- Full Electron/Tauri implementation: V3 only produces feasibility spike unless the user approves packaging work later.
- Autonomous external publishing and living-author imitation: outside product and safety boundaries.

## Risks

- V3 needs first-class persistence for narrative systems. If DB/API/UI are skipped and only domain helpers are added, advanced intelligence will not be product usable.
- Retrieval ranking changes can silently degrade writing quality. Regression snapshots are mandatory before changing retrieval policy.
- Similarity guard can produce false positives. Tests must cover false-positive handling and evidence without storing protected source text.
- Branch/retcon automation can cause broad changes. Approval gates and regression checks must run before accepted manuscript versions are affected.
- Semantic diff can become too broad. Keep it scoped to narrative state entities named in the design.
- Observability must use real run data, not demo counters.

## Assumptions

- V3 begins after V2 is committed and pushed.
- SQLite local vector storage is acceptable because the design specifies a vector adapter and first implementation local vector store.
- Embeddings may come from the OpenAI provider through LLM Gateway, but tests use deterministic fake embeddings.
- UI work in V3 is not polish; it exists where authors need inspection, approval, comparison, restore, or operational control.
- Electron/Tauri remains a feasibility spike because the design permits desktop packaging as an extension boundary, not a current product requirement.

## Open Questions

- Whether the local vector store should use a SQLite extension if available or a pure TypeScript similarity scan for the initial local implementation. This plan starts with pure local storage behind the adapter to avoid platform coupling.
- Whether branch/retcon visual impact should be graph-first or table-first. This plan starts with an inspectable impact map data model and a table/tree UI that can later render a graph.
- Whether scheduled backups should run only while the API server is active. This plan assumes local app runtime owns scheduling.

## Self-Review Checklist

- [ ] Every user-listed V3-1 through V3-8 item maps to a design anchor and stage.
- [ ] Ending, closure, and final payoff requirements from the design doc map to V3-2E and are not merely mentioned as file ownership.
- [ ] Every stage has expected failing tests, implementation steps, verification commands, and a commit boundary.
- [ ] V3 does not repeat V2 foundation/CRUD work.
- [ ] Advanced systems include DB/API/UI where product use or governance requires it.
- [ ] Source-policy, similarity, authorship, canon, branch, retcon, and restore gates require approval for high-risk changes.
- [ ] Retrieval changes are guarded by regression evaluation.
- [ ] Observability uses real persisted run data.
- [ ] Any unfinished item at V3 completion is explicitly listed as Open Question or Deferred with reason.
