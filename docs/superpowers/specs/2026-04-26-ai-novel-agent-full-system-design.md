# AI Novel Agent Full System Design

Date: 2026-04-26

## Purpose

Build a full-featured AI novel creation system for Chinese long-form and web-novel authors. The product is a local Web writing workspace with an API-shaped modular monolith architecture. It supports multi-agent story development, long-form memory, structured sample and technique libraries, editorial review, automatic revision support, and serialization operations.

The system is not a generic chatbot and not a fully autonomous content mill. It is a professional writing workspace where the author remains the final creative authority. Agents can propose, draft, review, revise, summarize, and extract memory, but high-risk canon, plot, publishing, and source-policy decisions require user approval.

## Product Positioning

Primary audience:

- Chinese web-novel and long-form serial authors.
- Authors who need help managing long projects, frequent updates, plot consistency, reader feedback, and chapter-level momentum.

Secondary compatible audience:

- General long-form fiction authors.
- Genre fiction authors who need worldbuilding, character arcs, and continuity support.

Primary form:

- Local Web workspace opened in a browser.
- Internally designed as front-end plus API modules so it has clean extension boundaries for desktop packaging, plugins, cloud sync, and external clients.

Architecture shape:

- Modular monolith first.
- Strong domain boundaries.
- Local-first storage.
- Provider-agnostic model access.
- Durable jobs and replayable agent runs.

## Core Principles

- Long-form continuity is the main product value.
- Canon must be governed, not inferred casually.
- Every agent run must be traceable through input, context, prompt version, output, cost, and user adoption.
- Samples are structured craft knowledge, not a raw imitation warehouse.
- Review should preserve author voice and apply the smallest effective fix.
- Serialization guidance should support long-term reader promises, not chase every short-term comment.
- All high-risk changes enter a decision queue for user approval.

## System Layers

### Creative Feature Layer

- Project memory.
- Manuscript editor.
- Story bible.
- Multi-agent writing workflows.
- Sample, trope, technique, style, and genre libraries.
- Review and revision.
- Serialization operations.
- Import, export, backup, and restore.

### Intelligent Orchestration Layer

- Workflow engine.
- Agent orchestrator.
- Task contracts.
- Context builder.
- Retrieval engine.
- LLM gateway.
- Quality evaluation.
- Review board.
- Revision loop.
- Memory extraction.

### Governance Layer

- Canon ledger.
- Memory status transitions.
- Source and rights policy.
- Prompt and run versioning.
- Artifact store.
- Event ledger.
- Approval requests.
- Data quality issues.
- Evaluation harness.
- Observability and cost tracking.

## Main Workspace

The workspace uses a professional writing-cockpit layout instead of a generic chat interface.

Primary screens:

- Project Dashboard: progress, current chapter, risks, decisions, open conflicts, upcoming serialization tasks.
- Manuscript Editor: chapter tree, scene beats, rich text editor, inline review findings, agent actions, version comparison.
- Story Bible: characters, factions, world rules, locations, timeline, plotlines, foreshadowing, canon ledger.
- Agent Room: run workflows, inspect context packs, compare agent outputs, review run graphs, approve memory changes.
- Knowledge Library: samples, tropes, techniques, genre rules, style profiles, review rules, source policies.
- Review Center: findings, quality scores, revision plans, false-positive handling, recurring issue trends.
- Serialization Desk: update calendar, title suggestions, hooks, reader feedback, promise tracker, next-chapter strategy.
- Version History: manuscript, outline, canon, prompt, run, and artifact versions.
- Settings: model providers, budgets, defaults, source policies, import/export, backups.

Important UX features:

- Focus mode for quiet writing.
- Decision queue for approvals and high-risk changes.
- Context inspector showing exactly what memory and samples each agent used.
- Story maps for timeline, relationship graph, faction graph, foreshadowing board, emotional arc, and chapter hook distribution.
- Inline editorial comments with one-click apply, reject, ask why, or convert to task.
- Diff-based revision review.
- Command palette for common actions.
- Global search across manuscript, canon, samples, runs, review findings, and reader feedback.
- User-selectable intelligence level: quiet, collaborative, or director mode.

## Domain Model

### Manuscript Entities

- Project
- Volume
- Chapter
- Scene
- SceneBeat
- ManuscriptVersion
- ChapterSummary
- SceneSummary
- VolumeSummary
- ArcSummary
- ProjectSummary

### Character and World Entities

- Character
- CharacterState
- CharacterVoiceProfile
- CharacterRelationship
- Faction
- WorldItem
- Location
- PowerSystemRule
- EntityAlias
- EntityMention
- EntityLink

### Narrative Entities

- Plotline
- PlotBeat
- Foreshadowing
- TimelineEvent
- NarrativeState
- ReaderContract
- EmotionalArcPoint

### Memory Governance Entities

- CanonFact
- CanonLedgerEntry
- MemoryVersion
- MemoryDecision
- ConflictRecord
- ApprovalRequest
- SourceReference
- Scope
- DataQualityIssue

Memory statuses:

- Candidate: unconfirmed idea or extracted fact.
- Draft: working material that can be used with caution.
- Canon: confirmed fact agents must obey.
- Deprecated: no longer active.
- Conflict: incompatible or unresolved fact.

Allowed status transitions:

- Candidate to Draft
- Draft to Canon
- Canon to Deprecated
- Canon to Conflict
- Conflict to Canon
- Conflict to Deprecated
- Conflict to Draft

Canon facts must have a source and confirmation trail. High-risk canon changes require an ApprovalRequest.

### Agent and Workflow Entities

- AgentDefinition
- TaskContract
- PromptVersion
- WorkflowDefinition
- AgentRun
- RunStep
- ContextPack
- ContextCitation
- Artifact
- RunCost
- RunError
- EvaluationCase
- EvaluationResult

Each AgentRun records:

- Agent identity.
- Task type.
- Workflow type.
- Prompt version.
- Model provider and model name.
- Input artifacts.
- Context pack.
- Output artifacts.
- Run graph steps.
- Cost, tokens, duration.
- Error and retry information.
- User adoption or rejection.

### Knowledge Library Entities

- KnowledgeItem
- Material
- Sample
- Trope
- Technique
- GenreRule
- ScenePattern
- CharacterTemplate
- WorldTemplate
- StyleProfile
- ReviewRule
- SourcePolicy
- EmbeddingRecord
- Tag
- AntiPattern
- StyleExperiment

SourcePolicy records:

- Source type: original, user note, licensed, public domain, web excerpt, agent summary.
- Allowed use: inspiration, analysis, structure, style parameters, generation support.
- Prohibited use: imitation, training, commercial use, verbatim reuse.
- Attribution requirements.
- License notes.
- Similarity risk level.

### Review and Serialization Entities

- ReviewReport
- ReviewFinding
- RevisionSuggestion
- QualityScore
- ReviewProfile
- FalsePositiveRecord
- SerializationPlan
- PublishChecklist
- UpdateSchedule
- ReaderFeedback
- ReaderFeedbackSummary
- ReaderSegment
- ReaderPromise
- PlatformProfile
- SerializationExperiment

## Storage Rules

- The relational database stores identity, relationships, state, metadata, and version pointers.
- Large text, generated outputs, context packs, reports, and diffs are stored as versioned artifacts.
- Every artifact has a type, hash, source, version, and related run.
- Vector indexes store embeddings and references only. They are not the source of truth.
- Full-text indexes support precise lookup for names, terms, dialogue, comments, and findings.
- Important entities use soft delete or tombstones, not hard delete.
- Import batches are tracked so bad imports can be rolled back or reprocessed.
- A portable project bundle supports backup, restore, and migration.

Common database invariants:

- CanonFact must have a source.
- Canon status must have a confirmation record.
- ReviewFinding must target a specific manuscript version.
- AgentRun must reference a PromptVersion.
- Artifact must have a hash.
- EmbeddingRecord must record embedding model and version.
- SourcePolicy must participate in sample retrieval.
- High-risk changes must have an ApprovalRequest.

## Memory System

The memory system is a novel canon ledger plus narrative state machine plus retrieval policy system.

It stores:

- Confirmed canon.
- Draft and candidate ideas.
- Deprecated facts.
- Conflict records.
- Character states.
- Character voices.
- Timeline events.
- Open and paid-off foreshadowing.
- Reader promises.
- Emotional arcs.
- Chapter and arc summaries.
- Source and confidence metadata.

Every important memory item has:

- Source.
- Status.
- Scope.
- Version.
- Confidence.
- First-seen location.
- Confirmation trail.
- Related entities.
- Dependency links.

After a chapter is finalized, a memory extraction workflow identifies:

- New facts.
- Changed character states.
- Relationship changes.
- New or resolved foreshadowing.
- Timeline updates.
- Worldbuilding changes.
- Potential conflicts.
- Candidate canon updates.

Risky updates enter the decision queue.

## Agent Operating System

Agents are controlled role modules inside workflows, not unconstrained chat personas.

Core agents:

- Chief Editor Agent: positioning, premise, reader contract, target audience, creative risks.
- Planner Agent: main plot, subplots, arcs, volumes, chapter goals, reveals.
- Lore Keeper Agent: canon, timeline, conflicts, world rules, continuity.
- Scene Designer Agent: scene goals, beats, conflict, information flow, hook placement.
- Writer Agent: draft scenes, dialogue, description, rewrites.
- Editor Agent: pacing, structure, readability, style, character behavior.
- Continuity Sentinel Agent: canon conflicts, timeline errors, regression checks.
- Voice Director Agent: narrator style and character dialogue consistency.
- Research Agent: source-backed factual support for real-world domains.
- Market Analyst Agent: genre expectations, reader positioning, serialization strategy.
- Serialization Agent: title, hooks, update plan, feedback summary, next-chapter strategy.
- Memory Curator Agent: extract facts, classify memory, propose canon updates.

Agent operating rules:

- Agents receive scoped context packs, not unrestricted database access.
- Agents output typed artifacts.
- Agents can propose changes but cannot silently change canon.
- High-risk changes require approval.
- Agent runs are saved as run graphs.
- Agent outputs are validated against schemas.
- Failed or malformed outputs can be repaired, retried, or downgraded.
- Long workflows are resumable, cancellable, replayable, and inspectable.

Risk levels:

- Low: title ideas, wording alternatives, summaries, safe copy edits.
- Medium: scene order changes, new supporting characters, added setup.
- High: canon changes, character death, main plot redirection, world-rule changes, publication decisions.

## Workflows

### Project Setup

1. User provides initial idea.
2. Chief Editor Agent proposes positioning and reader contract.
3. Planner Agent proposes premise, arcs, and initial structure.
4. Lore Keeper Agent creates initial canon candidates.
5. User confirms initial project memory.

### Chapter Creation

1. Select chapter location.
2. Context Builder creates task-specific context.
3. Planner Agent confirms chapter goal.
4. Scene Designer Agent creates scene beats.
5. Writer Agent drafts scenes.
6. Review board checks continuity, structure, voice, style, and serialization fit.
7. Writer Agent produces revisions.
8. User reviews diffs and approves final text.
9. Memory Curator extracts candidate updates.
10. User approves high-risk memory changes.
11. Serialization Agent prepares title, hook, preview, and next-chapter strategy.

### Review and Revision

1. Review profile is selected: light, standard, deep, targeted, or publish.
2. Review agents produce evidence-backed findings.
3. Findings are deduplicated and severity-calibrated.
4. Revision suggestions are generated with the smallest effective patch.
5. User applies, rejects, asks why, or converts findings to tasks.
6. System rechecks affected facts and style.
7. User preference learning records adoption and rejection.

### Serialization Loop

1. Chapter enters publish-ready workflow.
2. Publish checklist verifies readiness.
3. Title, hook, preview, and next-chapter strategy are generated.
4. User publishes externally or marks as published.
5. Reader feedback is imported manually through paste or file import in the initial local product; platform connectors are treated as extension modules behind the same import interface.
6. Feedback is summarized with confidence and reader segment.
7. Long-term promises, churn signals, and arc rhythm are updated.
8. Next chapter strategy is added to planning context.

## Retrieval and Context Builder

All agent runs must use the Context Builder. Agents cannot bypass it to query arbitrary data.

Context pack sections:

- Task goal.
- Agent role.
- Output schema.
- Risk level.
- Current project, volume, chapter, and scene.
- Relevant canon constraints.
- Character states.
- Character voices.
- Recent summaries.
- Current arc state.
- Reader contract.
- Open plotlines.
- Open foreshadowing.
- Timeline constraints.
- Style profile.
- Genre rules.
- Technique support.
- Negative memory.
- Source and policy warnings.
- Conflict warnings.
- Citations.

Retrieval pipeline:

1. Understand task.
2. Rewrite into retrieval plan.
3. Expand entities, aliases, and linked relationships.
4. Apply structured filters for project, scope, status, chapter range, and source policy.
5. Run keyword search.
6. Run vector search.
7. Inject must-have constraints.
8. Retrieve relevant negative memory.
9. Scan conflicts.
10. Rank by scope, freshness, status, evidence quality, and task strategy.
11. Deduplicate and compress.
12. Allocate context budget.
13. Store context pack, citations, exclusions, warnings, and retrieval trace.

Retrieval must prefer:

- User-authored and user-confirmed material.
- Canon over Draft.
- Project-specific material over global samples.
- Recent relevant summaries over stale unrelated details.
- Licensed or original samples over restricted samples.

Retrieval evaluation:

- Each project can accumulate test queries.
- Tests verify that important facts are retrieved.
- Tests verify that unsafe or forbidden samples are excluded.
- Prompt, model, embedding, and retrieval policy changes run against evaluation cases.

## Knowledge, Sample, and Style Library

The knowledge library stores structured craft knowledge.

It includes:

- Materials and research notes.
- Tropes.
- Narrative techniques.
- Genre rules.
- Scene patterns.
- Character templates.
- World templates.
- Anti-patterns.
- Style profiles.
- Voice profiles.
- Review rules.
- Source policies.
- Style experiments.

Knowledge lifecycle:

1. Ingest source and raw material.
2. Record ownership and usage rights.
3. Extract summary, beats, techniques, effects, and risks.
4. Normalize tags and genre taxonomy.
5. User reviews or confirms.
6. Retrieval policies allow or block usage.
7. Usage and adoption are tracked.
8. Low-value, risky, or outdated items are deprecated.

Style handling:

- Style is controlled with parameters rather than named living-author imitation.
- The system can analyze technique, rhythm, structure, and style dimensions.
- It should not provide a core feature to imitate a specific living author's prose.
- It should not feed long copyrighted passages into generation.
- Risky outputs can be checked for similarity against protected samples.

Style layers:

- Global narrator style.
- Project style.
- Volume style.
- Scene-mode style.
- Character dialogue voice.
- Special document style such as letters, system messages, records, or forum posts.

## Review and Revision System

Review is evidence-based and style-preserving.

Review dimensions:

- Continuity.
- Plot structure.
- Character motivation.
- Character voice.
- Narrator style.
- Pacing.
- Emotional arc.
- Web-novel hook and payoff.
- Reader contract match.
- Source and factual reliability when relevant.

Review profiles:

- Light review.
- Standard review.
- Deep review.
- Targeted review.
- Publish review.

ReviewFinding includes:

- Category.
- Severity.
- Location in manuscript version.
- Problem statement.
- Evidence citations.
- Impact.
- Fix options.
- Auto-fix risk.
- Status.

Revision rules:

- Apply the smallest effective change.
- Preserve author voice.
- Preserve intentional ambiguity and style.
- Do not add canon casually.
- Show diff before applying meaningful edits.
- High-risk edits require approval.
- Recheck after revision.

The system learns from:

- Accepted suggestions.
- Rejected suggestions.
- False-positive labels.
- User notes such as "this is a deliberate伏笔".
- Recurring edits.

Quality trend tracking:

- Continuity score.
- Character consistency.
- Pacing.
- Hook strength.
- Style match.
- Reader contract fit.
- Recurring issues.
- Impact of adopted changes.

## Serialization System

The serialization system supports sustained long-form publishing.

Core features:

- Update calendar.
- Chapter buffer management.
- Draft readiness.
- Publish checklist.
- Title variants.
- Opening hook and ending hook checks.
- Satisfaction point checks.
- Reader feedback import.
- Feedback confidence scoring.
- Reader segments.
- Promise tracker.
- Arc rhythm monitoring.
- Churn signal detection.
- Platform profile.
- Experiment log.
- Burnout guard.

Serialization signals:

- Planned versus actual updates.
- Ready chapters and draft chapters.
- Word count.
- Hook trend.
- Payoff frequency.
- Compression or drag in pacing.
- Reader confusion.
- Reader excitement.
- Recurring complaints.
- Promise aging.
- Buffer risk.

Short-term feedback cannot override long-term structure without explicit user approval. The system should distinguish a comment's surface request from the underlying issue.

## Technical Architecture

Recommended stack:

- Frontend: React, Vite, and TypeScript.
- Backend: Node.js and TypeScript API modules.
- Editor: TipTap for prose editing, paired with dedicated diff and review surfaces.
- Validation: Zod.
- Data access: repository layer with Drizzle.
- Local database: SQLite with WAL.
- Future database path: PostgreSQL-compatible schema patterns.
- Search: SQLite FTS for full-text search plus a vector retrieval adapter; the first implementation uses a local vector store through this adapter.
- Jobs: durable local queue with future Redis/BullMQ-compatible boundary.
- Testing: Vitest and Playwright.

Main modules:

- domain
- project
- manuscript
- memory
- knowledge
- agents
- workflow
- retrieval
- review
- serialization
- provider
- evaluation
- import_export
- observability
- settings

The domain core must not depend on UI, database implementation, or model provider.

### LLM Gateway

All model calls go through LLM Gateway.

Responsibilities:

- Provider adapters.
- Text generation.
- Structured generation.
- Embeddings.
- Streaming.
- Prompt versioning.
- Schema validation.
- Retry and repair.
- Model routing.
- Cost estimation.
- Context truncation.
- Safety and source-policy filters.
- Call logging.

ProviderAdapter interface:

- generateText
- generateStructured
- streamText
- embedText
- estimateCost

### Durable Jobs

Long-running tasks use jobs:

- Import and extraction.
- Embedding generation.
- Multi-agent writing.
- Deep review.
- Batch summaries.
- Evaluation runs.
- Export and backup.

Jobs support:

- Pause.
- Cancel.
- Retry.
- Resume.
- Replay.
- Intermediate artifacts.
- Failure records.

### Observability

Track:

- Cost per run.
- Tokens.
- Duration.
- Failure rate.
- Retry count.
- Context length.
- Model/provider usage.
- Agent quality outcomes.
- User adoption.
- Workflow bottlenecks.

## Import, Export, and Backup

Import sources:

- txt
- markdown
- docx
- pasted chapters
- structured character sheets
- user notes
- sample library entries

Import workflow:

1. Create ImportBatch.
2. Store raw file artifact.
3. Parse structure.
4. Extract chapters, characters, settings, timeline, and possible canon.
5. Mark extracted memory as Candidate.
6. User reviews confirmation queue.

Export targets:

- Full manuscript.
- Volume.
- Chapter.
- Story bible.
- Review report.
- Serialization plan.
- Project bundle.
- Knowledge library subset.

Project bundle includes:

- Project metadata.
- Chapters and versions.
- Artifacts.
- Canon and memory.
- Knowledge items.
- Source policies.
- Run logs.
- Settings snapshot.

## Safety and Rights

The system supports source-aware creation:

- Source policies are required for sample use.
- Restricted samples are excluded from generation context.
- Long copyrighted passages are not used as generic prompt fuel.
- Living-author imitation is not a core feature.
- API keys are stored locally and protected.
- Sensitive content is not written into ordinary logs.
- Users can inspect external model context before sending.
- Projects can be marked as no-external-model if needed.

## Implementation Strategy

The scope remains full-system, but implementation should be layered so every phase leaves the system coherent.

Foundational phase:

- Domain core.
- Project/manuscript model.
- SQLite storage.
- Artifact store.
- AgentRun and PromptVersion.
- LLM Gateway.
- Basic Context Pack.

Memory and retrieval phase:

- Canon ledger.
- Memory statuses and approvals.
- Full-text search.
- Vector retrieval adapter.
- Context citations.
- Retrieval trace.

Agent workflow phase:

- Chief Editor, Planner, Lore Keeper, Writer, Editor, Memory Curator.
- Task contracts.
- Run graph.
- Durable job worker.
- Schema validation.

Knowledge phase:

- Sample and technique library.
- SourcePolicy.
- StyleProfile.
- AntiPattern.
- Knowledge lifecycle.

Review phase:

- ReviewFinding.
- Review profiles.
- Inline comments.
- Revision suggestions.
- Diff review.
- False positive learning.

Serialization phase:

- Update calendar.
- Publish checklist.
- Title and hook generation.
- Reader feedback import.
- Promise tracker.
- Arc rhythm.

Advanced governance phase:

- Evaluation harness.
- Regression checks.
- Context inspector.
- Data quality dashboard.
- Similarity guard.
- Backup/restore bundle.

This is a development sequence, not a scope reduction.

## Implementation Defaults

The implementation plan should use these defaults unless the user overrides them:

- Frontend stack: React, Vite, TypeScript.
- Backend stack: Node.js, TypeScript API modules.
- Data access: Drizzle with SQLite WAL.
- Search: SQLite FTS plus vector retrieval behind an adapter.
- Initial product mode: local-first, single-user, with owner/profile abstractions kept in the domain model for future multi-user support.
- Initial LLM provider: provider-agnostic gateway with OpenAI as the first configured provider, because it supports text generation, structured outputs, streaming, and embeddings through one integration path.

## Acceptance Criteria for the Full Design

The system design is acceptable if it supports:

- Creating and managing a long-form novel project.
- Maintaining project memory with canon governance.
- Running multi-agent workflows with replayable runs.
- Writing and revising chapters using task-specific context.
- Tracking samples, techniques, style profiles, and source policies.
- Reviewing chapters with evidence-backed findings.
- Applying controlled revisions with diff and recheck.
- Extracting memory from finalized chapters.
- Supporting serialization planning and reader feedback.
- Importing, exporting, backing up, and restoring projects.
- Evaluating prompt/model/retrieval changes with project-specific cases.
