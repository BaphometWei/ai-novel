# AI Novel Agent Full System Design

Date: 2026-04-26

## Purpose

Build a full-featured AI novel creation system for Chinese long-form and web-novel authors. The product is a local Web writing workspace with an API-shaped modular monolith architecture. It supports multi-agent story development, long-form memory, foreshadowing and reader-promise tracking, structured sample and technique libraries, agent-assisted authoring, editorial review, automatic revision support, and serialization operations.

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
- Foreshadowing is a tracked reader promise, not just a note. The system must help authors preserve, reinforce, pay off, transform, delay, or abandon promises deliberately.
- Every agent run must be traceable through input, context, prompt version, output, cost, and user adoption.
- Samples are structured craft knowledge, not a raw imitation warehouse.
- Review should preserve author voice and apply the smallest effective fix.
- Serialization guidance should support long-term reader promises, not chase every short-term comment.
- All high-risk changes enter a decision queue for user approval.
- Agent capability must not be reduced by a simplified interface. The interface controls visibility, initiative, and timing; the underlying agent capabilities remain available through workflows, commands, and expert views.
- Agent-authored prose is always a draft until the user accepts it. New facts created by agent-authored prose enter memory extraction and canon governance before becoming authoritative.

## System Layers

### Creative Feature Layer

- Project memory.
- Manuscript editor.
- Story bible.
- Foreshadowing and reader-promise board.
- Multi-agent writing workflows.
- Agent-assisted authoring from local rewrites to full chapter drafts.
- Sample, trope, technique, style, and genre libraries.
- Review and revision.
- Serialization operations.
- Import, export, backup, and restore.

### Intelligent Orchestration Layer

- Workflow engine.
- Creative Copilot Runtime.
- Agent orchestrator.
- Task contracts.
- Context builder.
- Retrieval engine.
- Foreshadowing health and payoff-window detection.
- LLM gateway.
- Quality evaluation.
- Review board.
- Revision loop.
- Memory extraction.
- Authorship control.

### Governance Layer

- Canon ledger.
- Memory status transitions.
- Reader-promise lifecycle and risk governance.
- Source and rights policy.
- Prompt and run versioning.
- Artifact store.
- Event ledger.
- Approval requests.
- Attention and risk gates.
- Data quality issues.
- Evaluation harness.
- Observability and cost tracking.

## Main Workspace

The workspace uses a professional writing-cockpit layout instead of a generic chat interface.

Primary screens:

- Project Dashboard: progress, current chapter, risks, decisions, open conflicts, upcoming serialization tasks.
- Manuscript Editor: chapter tree, scene beats, rich text editor, inline review findings, agent actions, version comparison.
- Story Bible: characters, factions, world rules, locations, timeline, plotlines, foreshadowing, reader promises, canon ledger.
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
- Foreshadowing board with simple user-facing states: pending confirmation, active, ready for payoff, resolved, problem, and parked.
- Inline editorial comments with one-click apply, reject, ask why, or convert to task.
- Diff-based revision review.
- Command palette for common actions.
- Global search across manuscript, canon, samples, runs, review findings, and reader feedback.
- Creative Copilot controls for initiative, execution depth, visibility, risk handling, and authorship level.
- "Current most useful" side panel that changes by context: writing, review, canon work, publishing, blocking decisions, or deep debugging.
- Command palette access to every major capability, including deep review, plot branch generation, character voice checks, canon candidate creation, context inspection, and chapter/title generation.
- Agent authoring controls for local rewrite, continuation, scene draft, chapter draft, and director-style multi-step drafting.

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
- ForeshadowingCandidate
- ReaderPromise
- PromiseHealthAssessment
- PayoffPlan
- PayoffReview
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
- CopilotRuntimePolicy
- AuthorshipSession
- WritingContract
- AgentRun
- RunStep
- ContextPack
- ContextCitation
- Artifact
- RunCost
- RunError
- EvaluationCase
- EvaluationResult

CopilotRuntimePolicy records default behavior for a project or user:

- Agent initiative level.
- Execution depth.
- UI visibility level.
- Risk gate rules.
- Attention budget.
- Authorship defaults.
- Cost budget.
- User-specific interruption preferences.

AuthorshipSession records each explicit agent-writing request:

- Authorship level.
- Target manuscript range.
- Writing contract.
- Context pack.
- Generated draft artifacts.
- Self-check and review artifacts.
- User acceptance decisions.
- Memory extraction results.

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

## Foreshadowing and Reader Promise System

The Foreshadowing and Reader Promise System tracks unresolved narrative questions, setup details, mysteries, future payoffs, and reader expectations as first-class story assets. Its purpose is not to create a noisy list of every possible clue. Its purpose is to ensure that meaningful promises can be remembered across very long manuscripts and handled deliberately.

This system should be understood as reader-promise tracking:

- What question or expectation did the story create?
- Why would a reader remember or care about it?
- How important is it?
- Has it been reinforced?
- Is the current story location a good payoff window?
- Should the promise be reinforced, paid off, transformed, delayed, or abandoned?
- Did the payoff actually satisfy the original promise?

Foreshadowing levels:

- Micro promise: local detail or scene-level setup.
- Chapter promise: setup expected to matter within a few chapters.
- Volume promise: setup expected to matter within the current volume.
- Main-plot promise: cross-volume setup tied to core plot, identity, antagonist, world rule, or major relationship.
- Endgame promise: long-range setup intended for late-stage or finale payoff.

Reader-promise strength:

- Low: atmospheric or optional detail.
- Medium: affects a side thread, character impression, or local mystery.
- High: creates a clear reader expectation.
- Core: tied to main plot, protagonist identity, antagonist plan, world truth, or finale expectation.

Candidate handling:

- Low-confidence detections enter a silent pool and do not interrupt the author.
- Medium-confidence detections are folded into chapter-end summaries.
- High-confidence detections enter a candidate confirmation list.
- Core suspected promises enter the decision queue.

Internal lifecycle states may be detailed, but the UI should expose only simple states:

- Pending confirmation.
- Active.
- Ready for payoff.
- Resolved.
- Problem.
- Parked.

Internal states can include:

- Candidate.
- Seeded.
- Reinforced.
- Active.
- Near payoff.
- Paid off.
- Transformed.
- Delayed.
- Dropped.
- Conflict.

Promise health assessment:

- Normal: waiting period and story relevance are appropriate.
- Needs reinforcement: the promise should be reminded or echoed, not paid off yet.
- Ready for payoff: current entities, arc state, and reader expectation make payoff timely.
- Expiration risk: the promise has been absent long enough to risk reader frustration or forgetfulness.
- Conflict risk: later story material contradicts or weakens the promise.
- Insufficient payoff: the story touched the promise but did not satisfy the original question.

Payoff strategies:

- Reinforce: remind readers without answering yet.
- Small payoff: answer the surface question while preserving deeper tension.
- True payoff: answer the core question.
- False payoff: provide an apparent answer intended for later reversal.
- Transform: answer one promise while turning it into a larger promise.
- Delay: intentionally postpone with a clear plan or renewed setup.
- Abandon: explicitly mark the promise as dropped, with a reason, so agents stop trying to use it.

Foreshadowing records should include:

- Title.
- Level.
- Promise strength.
- Surface clue.
- Hidden question.
- Reader expectation.
- First appearance location.
- Supporting citation or summary.
- Related characters, objects, locations, factions, world rules, plotlines, and chapters.
- Current status.
- Current health.
- Last reinforcement location.
- Payoff window.
- Candidate payoff options.
- Actual payoff location.
- Payoff review result.

Automation rules:

- The system may automatically detect candidate promises during import, chapter finalization, review, and agent-assisted authoring.
- The system should not ask the author to fill complex forms during active writing.
- Agents may fill metadata, but the author confirms high-importance or high-risk promises.
- Similar candidate promises should be mergeable.
- Ordinary atmosphere and flavor should not become active promises unless repeatedly emphasized or user-confirmed.

User actions should stay simple:

- Confirm as promise.
- Not a promise.
- Merge with existing promise.
- Raise or lower importance.
- Mark as long-range.
- Pay off now.
- Remind later.
- Park.
- Abandon.

Runtime behavior:

- During free writing, only highly relevant or high-risk promises should interrupt.
- At chapter end, new, reinforced, resolved, or risky promises are summarized.
- During review, the system checks missed payoff opportunities, premature reveals, unresolved promises, and insufficient payoffs.
- During publish preparation, only high-risk reader-promise issues become blocking.
- During blocked writing or director mode, unresolved promises can be used as plot fuel.
- During serialization review, promises mentioned by reader feedback receive higher attention but cannot override the long-term plan without user approval.

Long-form retrieval support:

- Reader promises are indexed by entity links, chapter range, plotline, level, strength, status, and health.
- Context Builder must retrieve relevant active or risky promises when current writing involves related entities, objects, secrets, factions, or plotlines.
- Long-running promises are summarized at multiple levels so a million-word manuscript does not rely on raw text recall.
- Payoff checks should cite the original setup and any reinforcements.

Payoff quality review checks:

- Did the payoff answer the hidden question?
- Did the payoff respect canon and prior clues?
- Did the payoff feel earned rather than arbitrary?
- Did it create an appropriate emotional, suspense, or satisfaction effect?
- Did it introduce a new promise that should be tracked?
- Was the payoff too small, too large, too early, or too late for its level and strength?

## Creative Copilot Runtime

Creative Copilot Runtime is the system-level coordinator that decides when agent capabilities run, how deeply they run, how much of their output is shown, and when the user must be interrupted.

It exists to keep the full agent system usable in real writing sessions. A simplified writing surface must not mean weaker agents. It only means the runtime chooses the right moment and level of disclosure.

Runtime dimensions:

- Intent: what the author is doing now, such as free writing, blocked writing, rewriting, review, canon work, outline planning, publish preparation, or reader feedback review.
- Initiative: quiet, collaborative, or director.
- Execution depth: quick, standard, or deep.
- Visibility: compact, full, or expert.
- Risk: low, medium, high, or blocking.
- Authorship level: author-led, local co-writing, scene draft, chapter draft, or director takeover.

Example runtime combinations:

- Free writing plus quiet initiative plus deep execution plus compact visibility means agents may run strong background checks, but only high-risk problems interrupt the author.
- Review plus collaborative initiative plus deep execution plus full visibility means the system shows detailed findings, evidence, revision suggestions, and diffs.
- Publish preparation always elevates blocking risks into visible publish checks, regardless of quiet mode.
- Blocked writing plus director initiative plus deep execution means planning, scene design, drafting, review, and revision can run as a guided workflow.

Runtime responsibilities:

- Detect the current writing context from screen, selection, workflow, manuscript state, and user command.
- Decide which agents should run and whether they run now, after a pause, at chapter end, or on explicit command.
- Apply attention budgets so low-value suggestions do not interrupt flow.
- Route high-risk outputs to the decision queue.
- Keep medium-risk findings in the side panel or review report.
- Keep low-risk observations in logs or folded reports.
- Preserve access to all strong capabilities through command palette, workflow entry points, and expert views.
- Explain visible suggestions through citations, risk, agent source, and context-pack references.
- Learn user preferences such as "do not interrupt while drafting," "always warn on character voice drift," or "ask before cost exceeds a configured budget."

High-risk or blocking events must be visible in every mode:

- Canon conflict.
- Character death.
- Main plot redirection.
- World-rule change.
- Source-policy violation.
- External publication readiness failure.
- Cost or context budget breach.
- Agent writing contract failure.
- Core reader-promise conflict or accidental payoff failure near publication.

## Authorship Control

Authorship Control defines who leads the current prose and how much drafting authority the agent has. It is part of Creative Copilot Runtime and is a first-class product capability.

Authorship levels:

- A0 Author-led: the author writes; agents run background checks, lightweight suggestions, and requested actions.
- A1 Local co-writing: the author selects text or a cursor location; the agent rewrites, continues, strengthens dialogue, adds description, or adjusts tone.
- A2 Scene draft: the agent writes a complete scene from a scene goal, involved characters, conflict, required information, emotional movement, word range, style, and constraints.
- A3 Chapter draft: the agent writes a full chapter from chapter goals, scene list, reader promise, previous-chapter payoff, foreshadowing requirements, style profile, and next-chapter hook.
- A4 Director takeover: the agent plans, drafts, self-checks, reviews, and revises a bounded manuscript range, stopping for high-risk decisions or contract failure.

Agent-written prose rules:

- Agent output is a draft artifact until accepted by the user.
- The system never silently overwrites final manuscript text.
- The user can accept, reject, compare, or partially accept generated text.
- Local accepted fragments can include dialogue lines, action beats, transitions, emotional direction, or scene structure without accepting the full draft.
- New facts introduced by agent prose are extracted as Candidate memory unless explicitly confirmed.
- A4 director takeover has explicit stopping conditions and cost limits.

Every A1-A4 request creates a WritingContract before prose generation.

WritingContract includes:

- Target range and authorship level.
- What must be written.
- Required canon constraints.
- Required plot movement.
- Required character change or emotional movement.
- Required information, payoff, foreshadowing, or hook.
- Style and voice constraints.
- Word range.
- Forbidden changes.
- Source-policy constraints.
- Stop conditions.
- Cost and iteration budget.

Agent authoring pipeline:

1. Create writing request.
2. Build task-specific context pack.
3. Generate WritingContract.
4. User confirms, edits, or skips confirmation depending on configured authorship level.
5. Generate draft artifact.
6. Run self-check against the WritingContract.
7. Run review and continuity checks.
8. Generate revision suggestions or revised draft.
9. Present diff and acceptance controls.
10. Extract candidate memory from accepted text.
11. Route risky memory changes to approval.

Acceptability checks:

- Contract completion.
- Canon compliance.
- Character voice match.
- Style match.
- Reader-contract fit.
- No unapproved high-risk fact.
- No forbidden source use.
- No unresolved blocking review finding.
- Worthiness as a manuscript candidate.

Multi-candidate drafting is supported but bounded. Default candidate count should be two or three, such as conservative, conflict-intensified, emotional, suspense, or payoff-focused variants.

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
- Agents can draft prose when the user chooses an authorship level that permits drafting.
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
2. Creative Copilot Runtime identifies intent and authorship level.
3. Context Builder creates task-specific context.
4. Planner Agent confirms chapter goal.
5. Scene Designer Agent creates scene beats.
6. Writer Agent drafts scenes when the selected authorship level permits agent drafting.
7. Review board checks continuity, structure, voice, style, and serialization fit.
8. Writer Agent produces revisions.
9. User reviews diffs and approves final text or selected fragments.
10. Promise tracking identifies new, reinforced, resolved, or risky reader promises.
11. Memory Curator extracts candidate updates from accepted text.
12. User approves high-risk memory and reader-promise changes.
13. Serialization Agent prepares title, hook, preview, and next-chapter strategy.

### Agent-Assisted Authoring

1. User selects authorship level A1, A2, A3, or A4.
2. User specifies the writing target, or the runtime infers it from selection and current workflow.
3. Context Builder gathers canon, recent summaries, scene or chapter goals, character voices, reader contract, style profile, and negative memory.
4. System creates a WritingContract.
5. User confirms or edits the contract when risk or configuration requires it.
6. Writer Agent generates draft artifacts.
7. Voice Director, Lore Keeper, and Editor Agents check the draft.
8. System either revises automatically within safe limits or presents findings and diffs.
9. User accepts, rejects, partially accepts, or asks for another candidate.
10. Accepted prose becomes a new manuscript version.
11. Promise tracking extracts candidate reader promises and payoff changes from accepted prose only.
12. Memory Curator extracts candidate facts from accepted prose only.
13. High-risk facts or reader promises enter the decision queue before becoming authoritative.

### Review and Revision

1. Review profile is selected: light, standard, deep, targeted, or publish.
2. Review agents produce evidence-backed findings.
3. Findings are deduplicated and severity-calibrated.
4. Revision suggestions are generated with the smallest effective patch.
5. User applies, rejects, asks why, or converts findings to tasks.
6. System rechecks affected facts and style.
7. System rechecks affected reader promises and payoff quality when relevant.
8. User preference learning records adoption and rejection.

### Serialization Loop

1. Chapter enters publish-ready workflow.
2. Publish checklist verifies readiness.
3. Title, hook, preview, and next-chapter strategy are generated.
4. User publishes externally or marks as published.
5. Reader feedback is imported manually through paste or file import in the initial local product; platform connectors are treated as extension modules behind the same import interface.
6. Feedback is summarized with confidence and reader segment.
7. Long-term promises, reader-promise mentions, churn signals, and arc rhythm are updated.
8. Next chapter strategy is added to planning context.

## Retrieval and Context Builder

All agent runs must use the Context Builder. Agents cannot bypass it to query arbitrary data.

Context pack sections:

- Task goal.
- Agent role.
- Output schema.
- Risk level.
- Authorship level and WritingContract when the task generates prose.
- Current project, volume, chapter, and scene.
- Relevant canon constraints.
- Character states.
- Character voices.
- Recent summaries.
- Current arc state.
- Reader contract.
- Reader promises and payoff health when relevant.
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
9. Retrieve relevant active, risky, or ready-for-payoff reader promises.
10. Scan conflicts.
11. Rank by scope, freshness, status, promise strength, health, evidence quality, and task strategy.
12. Deduplicate and compress.
13. Allocate context budget.
14. Store context pack, citations, exclusions, warnings, and retrieval trace.

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
- Foreshadowing and reader-promise health.
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
- Reader-promise health.
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
- Foreshadowing payoff window tracking.
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
- promises
- knowledge
- agents
- copilot_runtime
- authoring
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
- Creative Copilot Runtime.
- Authorship Control and WritingContract.
- Foreshadowing and Reader Promise System.
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
- Payoff window tracking.
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
- Tracking foreshadowing and reader promises with confidence, level, strength, health, payoff strategy, and simplified user controls.
- Running multi-agent workflows with replayable runs.
- Running Creative Copilot Runtime so strong agent capabilities are available without overwhelming the writing surface.
- Supporting authorship levels from author-led writing to local co-writing, scene drafting, chapter drafting, and bounded director takeover.
- Creating WritingContracts for agent-authored prose and checking draft output against them.
- Writing and revising chapters using task-specific context.
- Accepting, rejecting, or partially accepting agent-authored prose through versioned drafts and diffs.
- Tracking samples, techniques, style profiles, and source policies.
- Reviewing chapters with evidence-backed findings.
- Applying controlled revisions with diff and recheck.
- Extracting memory from finalized chapters.
- Recalling early reader promises in later chapters through entity links, summaries, retrieval policy, and context packs.
- Reviewing payoff quality and detecting missed, premature, insufficient, or conflicting payoffs.
- Supporting serialization planning and reader feedback.
- Importing, exporting, backing up, and restoring projects.
- Evaluating prompt/model/retrieval changes with project-specific cases.
