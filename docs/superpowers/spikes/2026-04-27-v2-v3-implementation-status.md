# V2/V3 Implementation Status Note

Date: 2026-04-27

## Scope Reviewed

This note summarizes the visible implementation surface after reviewing:

- `docs/superpowers/plans/2026-04-27-ai-novel-agent-full-system-implementation.md`
- `docs/superpowers/plans/2026-04-27-ai-novel-agent-v2-production-workflows-implementation.md`
- `docs/superpowers/plans/2026-04-27-ai-novel-agent-v3-intelligence-and-productization-implementation.md`
- `docs/superpowers/spikes/2026-04-27-local-desktop-packaging-feasibility.md`
- Current file and test names under `apps/`, `packages/`, and `tests/e2e/`

This is a documentation status read, not a full code audit or product acceptance pass.

## Current Read

The repository now has implemented, locally test-shaped slices for the main V2 production workflows and V3 intelligence/productization surfaces. As of the 2026-04-28 agent-system completion work, persistent writing runs, server-side context building, approval gating, decision-queue effects, durable backup/import/export handlers, review actions, gateway retry behavior, narrative extraction, project-scoped observability, backup restore sections, and web/API wiring are present in local code and tests.

That still should not be treated as live production acceptance. The verified local path intentionally uses fake providers, deterministic fixtures, injected fetch tests, local SQLite, and browser flows that avoid paid provider calls and real secrets. Final production evidence still depends on clean full verification, successful push, and the external operator inputs listed in `docs/operations/external-blockers.md`.

## Implemented Scaffold and Feature Slices

V2-visible areas:

- LLM gateway, provider config, prompt registry, OpenAI provider boundary, fake provider, and budget guard tests exist under `packages/llm-gateway`.
- Project, manuscript, chapter, artifact, agent run, context pack, settings, import/export, serialization, review, memory, knowledge, and versioning domain/repository surfaces are visible.
- API routes and tests exist for projects/manuscripts, agent runs, workflow, writing runs, memory, context packs, artifacts, settings, search, backup, import/export, approvals/governance-related flows, and workbench persistence.
- Web panels and tests exist for project dashboard, writing workbench, agent room, settings, import/export/backup, knowledge library, review center, serialization desk, and version history.
- E2E specs cover API-backed writing, workspace search/approval queue, settings, agent room, backup/import/export, version history, observability, retrieval evaluation, narrative intelligence, governance, branch/retcon, and review learning flows.

V3-visible areas:

- Retrieval intelligence exists across local vector store, retrieval policy, reranker, context compressor/builder, retrieval regression, and evaluation runner surfaces.
- Narrative intelligence modules and tests exist for promises, payoff, extraction, secrets, reveal planning, arcs, relationships, timeline, location, world rules, impact, retcon, regression, branches, closure, and health reporting.
- Governance/safety surfaces exist for authorship audit, source policy enforcement, similarity guard, approvals, and governance persistence/API/UI.
- Review learning and revision recheck surfaces exist across domain/workflow/repository/API/UI.
- Serialization intelligence exists across platform profiles, recommendations, serialization persistence, API/workbench surfaces, and UI tests.
- Branch, retcon, regression automation, version history, semantic diff, observability, scheduled backup, migration history, and desktop-packaging feasibility are represented by files/tests/docs.

## Local Completion Evidence

Implemented locally:

- Persistent writing runs now persist AgentRun, WorkflowRun, DurableJob, LLM call logs, context packs, and artifact metadata.
- Writing and orchestration routes build context server-side instead of trusting caller-supplied context sections.
- Accepted manuscript text is gated through provenance checks, memory candidate extraction, approval references, and approval decision effects before promotion.
- Durable runtime handlers cover backup create/verify/restore and import/export job execution.
- Backup manifests include canon, knowledge, source policies, chapters, versions, and artifact metadata needed for local restore.
- Narrative extraction rejects non-accepted manuscript versions and extracts promise, secret, arc, timeline, world rule, dependency, and closure state.
- Observability exposes project-scoped summaries from persisted snapshots when available, with live fallback.
- Frontend panels share selected project/client wiring for review, observability, manuscript acceptance, branch/retcon regression, and decision flows.

Still needs final local evidence before a production-hardening handoff:

- Fresh `npm run verify:local` after the last E2E and documentation updates.
- Successful normal `git push origin main`, without force push.
- Continued browser coverage against real local API for representative author workflows as the product scope expands.
- Restore rehearsal depth for destructive recovery and cross-project isolation beyond deterministic local fixtures.
- Representative corpus thresholds for retrieval, narrative quality, review learning, and acceptance gates.

External blockers that remain out of local automation:

- Live OpenAI-compatible provider credentials, model budget approval, and paid smoke-test policy.
- CI repository secrets, account permissions, branch policy, and log redaction decisions.
- Code signing certificates, release credentials, desktop packaging channel decisions, and OS keychain choices.
- Product-owner decisions for source-policy defaults, validation corpus use, and quality thresholds.

## Suggested Completion Gates

Before calling V2 production-complete:

- Run unit/API/e2e/build/database checks from a clean install.
- Verify real provider settings without exposing raw secrets; this is blocked on operator credentials and budget approval.
- Complete a browser-driven local workflow: create project, create chapter, generate draft, review, accept, extract memory, retrieve context, search, backup, restore, and inspect agent run trace.
- Confirm manual recovery docs exist for DB/artifact/backup failures.

Before calling V3 product-complete:

- Pass V2 gates first.
- Run retrieval regression and narrative regression suites against representative fixtures.
- Verify all V3 panels against the real API, not only mocked clients.
- Prove approval routing and traceability for high-risk narrative, governance, review, branch/retcon, and similarity/source-policy decisions.
- Prove scheduled backup, migration history, observability dashboard, restore validation, and failure reporting under local production-like settings.

## Bottom Line

V2/V3 are no longer just scaffolded; the core local production-hardening slices are implemented and covered by deterministic tests. The remaining gap is final evidence and external readiness: clean full local verification, successful push transport, real-provider validation, representative corpus thresholds, and operator-owned release/secret/certificate decisions.
