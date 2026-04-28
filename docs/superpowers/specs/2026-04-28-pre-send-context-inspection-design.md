# Pre-Send External-Context Inspection Design Spike

Date: 2026-04-28

## Purpose

Let authors inspect the exact context, warnings, and estimated provider spend before any external model call leaves the local workspace. This spike documents the intended route split and validation work. As of the local remaining-gap completion batch, the writing route split, manuscript editor confirmation UX, and orchestration prepare/execute route split are implemented locally with fake/local provider compatibility. Production provider validation and indexed pending-send storage remain deferred.

The design applies to external providers only. Fake and local providers should remain single-step by default so deterministic automation, local rehearsals, and no-secret test paths do not gain unnecessary confirmation state. A caller may explicitly request the two-phase path for fake/local providers when testing the confirmation UX, but that should be opt-in.

## Recommended Flow

External-provider calls use a two-phase `prepare` then `execute` flow.

1. `prepare` builds the same context pack the run would use, evaluates source-policy exclusions, calculates token and budget estimates, persists an inspectable draft of the pending send, and returns a short-lived confirmation handle.
2. The UI presents the prepared context pack, citations, exclusions, retrieval trace, budget estimate, source warnings, provider/model name, and no-external-model status before execution.
3. `execute` accepts the confirmation handle and a user confirmation decision. It revalidates project policy, provider settings, budget guardrails, and freshness of the prepared context before calling the external provider.
4. The actual provider call records the prepared context pack id, confirmation metadata, prompt version, budget estimate, final usage, and output artifacts on the resulting agent run/workflow run.

The prepare response must not be treated as a draft generation result. It is an inspectable pending send. If the user cancels, the system may retain the context-pack artifact and audit metadata, but it must not create model output artifacts or accepted manuscript versions.

## Provider Behavior

- External providers require `prepare` before `execute`.
- `execute` must fail closed if the confirmation handle is missing, expired, belongs to another project/user context, or no longer matches current provider/model/policy state.
- Fake/local providers continue through the existing single-step writing and orchestration routes unless the request explicitly asks for inspection mode.
- Fake/local inspection mode should use the same prepare payload shape as external providers but must not require secrets, paid calls, or long-lived provider credentials.
- No provider path should let caller-supplied raw `contextSections` bypass the context builder, source exclusions, or retrieval trace used for the prepared send.

## Writing Route Compatibility

Current writing runs use `POST /projects/:projectId/writing-runs` as the single-step route. The spike should validate one of these compatible approaches before implementation:

- Keep the current route for fake/local and add explicit external-provider subroutes such as `POST /projects/:projectId/writing-runs/prepare` and `POST /projects/:projectId/writing-runs/:preparedRunId/execute`.
- Or add an `inspectionMode`/`phase` field while preserving the current single-step request and response shape for fake/local callers.

Compatibility checks:

- Existing fake-provider route tests continue to create a run, context pack, draft artifact, self-check artifact, and awaiting-acceptance durable job in one request.
- External-provider writing requests cannot reach the provider adapter from the single-step route unless an explicitly approved compatibility decision says otherwise.
- Prepared writing runs persist enough state to recreate the exact prompt/context at execution time or reject execution as stale.
- Cancelled prepared runs do not look like failed provider calls and do not create draft output artifacts.

## Orchestration Route Compatibility

Current orchestration runs use `POST /orchestration/runs` and may include retrieval input or caller-supplied context sections. The spike should validate the same prepare/execute split for external-provider orchestration without breaking deterministic local orchestration.

Compatibility checks:

- Existing local orchestration callers remain single-step.
- External-provider orchestration can prepare a context pack and surface all warnings before calling the model.
- Prepared orchestration records include workflow type, task type, agent role, risk level, output schema, prompt version, provider/model, retrieval trace, and budget estimate.
- Execution rechecks project `externalModelPolicy` and provider availability immediately before the external call.
- High-risk orchestration approvals remain separate from external-send confirmation; a send confirmation is not approval to apply high-impact story or canon changes.

## UI Confirmation State

The UI should model prepared external sends as a distinct pending state:

- Show provider/model, estimated input tokens, budget estimate, context sections, citations, exclusions, source-policy warnings, and retrieval trace.
- Require an explicit confirm action before `execute`.
- Offer cancel/dismiss without creating provider output.
- Disable confirm when the project is `no-external-model`, provider settings are missing, budget/source warnings are blocking, or the prepared context is stale.
- Make refresh/reprepare visible when context changed after preparation.
- Keep fake/local default runs free of this confirmation step unless inspection mode was explicitly requested.

## Budget And Source Warnings

Prepare must surface warnings before execution:

- Provider/model missing or configured as external without approved use.
- Estimated input or output spend exceeds the configured provider/project budget.
- Context length is near or over model limits.
- Restricted samples, disallowed sources, or unresolved source-policy exclusions were omitted.
- Retrieval produced too little context, too much context, or excluded required items.
- Logs, traces, and UI summaries must avoid exposing provider secrets or private manuscript excerpts beyond the local workspace.

Blocking warnings should prevent `execute`; non-blocking warnings should require visible acknowledgement in the confirmation state.

## No-External-Model Interaction

Projects marked with external model use disabled must fail closed:

- `prepare` may either return a disabled-state preview without provider-call eligibility or return a policy error before persisting pending-send state.
- `execute` must always reject for disabled projects, even if the project was allowed during prepare.
- Fake/local single-step runs must still work for disabled projects.
- Tests should prove an external provider adapter is not called when `externalModelPolicy` is disabled.

## Validation Checklist

- Writing route compatibility: existing single-step fake/local writing runs still pass; external providers require prepare/execute; cancelled prepares create no output artifacts.
- Orchestration route compatibility: existing local orchestration remains single-step; external orchestration can prepare, inspect, and execute with fresh policy checks.
- UI confirmation state: pending prepared sends show context, warnings, budget/source state, confirm, cancel, stale refresh, and disabled confirm states.
- Budget/source warnings: blocking warnings prevent execute; non-blocking warnings require acknowledgement; source exclusions and retrieval trace are inspectable.
- No-external-model interaction: disabled projects block external prepare/execute provider calls while fake/local deterministic runs still work.

## Deferred Scope

The writing-route slice is implemented locally with `prepare`, `execute`, and `cancel` subroutes plus manuscript editor confirmation state. The orchestration slice now also has local `prepare`, `execute`, and `cancel` routes, Agent Room confirmation controls, and real-local E2E coverage using the fake provider. Indexed pending-send cleanup and provider-specific production validation remain deferred. The first local implementation stores prepared sends in durable job payloads to avoid a migration; a future production hardening pass should add indexed pending-send storage and retention policy if this flow becomes high volume.
