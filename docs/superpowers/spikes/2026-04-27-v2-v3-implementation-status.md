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

The repository has a broad implemented scaffold for both V2 production workflows and V3 intelligence/productization. The visible surface includes domain modules, persistence repositories, API routes, web panels, package-level tests, API tests, and e2e specs for most named V2/V3 areas.

That surface should not be treated as proof that V2 or V3 are production-complete. Many visible tests and plan snippets use fake providers, deterministic fixtures, mock clients, or mocked snapshots. That is appropriate for coverage and development, but it means the current evidence supports "implemented and test-shaped slices exist" more strongly than "real local product is complete under production conditions."

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

## Not Production-Complete by Current Evidence

The following remain productization gaps unless separately verified by a full acceptance run:

- Real-provider operation: fake providers and fake models remain common in runtime defaults and tests. Need explicit verification of configured OpenAI-compatible provider calls, streaming behavior, retry/repair metadata, budget enforcement, and secret redaction under real local settings.
- End-to-end persistence fidelity: repositories and API tests are visible, but production readiness needs a full local DB lifecycle check across create, migrate, backup, restore, resume workflow, replay lineage, and cross-project isolation.
- UI/API integration depth: many component tests use injected mock clients. Need browser-level verification against the real local API for all primary V2/V3 panels, not only isolated component contracts.
- Durable workflow behavior: workflow and durable job tests exist, but production readiness needs interruption/resume/replay checks around writing, review, backup, import/export, and agent-room actions.
- Narrative intelligence product usability: V3 engines are broadly present, but the product gap is proving inspectable state, approval routing, trace links, persistence, and author-facing explanations across realistic manuscript data.
- Retrieval quality: vector store, reranking, compression, and regression surfaces exist. Productization still needs seeded corpus evaluation, thresholds, regression snapshots, and failure triage workflow that reflects real author projects.
- Governance and safety hardening: source policy, similarity, authorship audit, and approval persistence are represented. Remaining work is proving enforcement at every generation/import/revision boundary, not only in standalone checks.
- Observability readiness: dashboards, metrics, repositories, and API tests are visible. Need real run telemetry coverage for cost, latency, token, quality, reliability, context, adoption, workflow bottleneck, and migration/backup health signals.
- Backup and migration readiness: backup, scheduled backup, migration, migration history, and restore tests exist. Need destructive-path restore rehearsal, backup-before-migration flow, artifact hash validation, and documented operator recovery steps.
- Desktop packaging: current spike recommends keeping packaging feasibility-only during V3. Full Electron/Tauri implementation, updater behavior, OS keychain storage, managed API lifecycle, and packaged DB/artifact path handling remain beyond current V3 scope.

## Suggested Completion Gates

Before calling V2 production-complete:

- Run unit/API/e2e/build/database checks from a clean install.
- Verify real provider settings without exposing raw secrets.
- Complete a browser-driven local workflow: create project, create chapter, generate draft, review, accept, extract memory, retrieve context, search, backup, restore, and inspect agent run trace.
- Confirm manual recovery docs exist for DB/artifact/backup failures.

Before calling V3 product-complete:

- Pass V2 gates first.
- Run retrieval regression and narrative regression suites against representative fixtures.
- Verify all V3 panels against the real API, not only mocked clients.
- Prove approval routing and traceability for high-risk narrative, governance, review, branch/retcon, and similarity/source-policy decisions.
- Prove scheduled backup, migration history, observability dashboard, restore validation, and failure reporting under local production-like settings.

## Bottom Line

V2/V3 are substantially scaffolded and many feature slices are test-covered. The remaining gap is productization evidence: real-provider operation, full local persistence lifecycle, real API-backed browser verification, recovery paths, and traceable approval/observability behavior across realistic end-to-end author workflows.
