# Orchestration Pre-Send Confirmation Design

## Goal

Bring orchestration runs to the same external-provider safety boundary as writing runs: local/fake orchestration remains single-step, while external-provider orchestration must be prepared, inspected, and explicitly confirmed before any provider call.

## Route Shape

- `POST /orchestration/runs` remains the existing single-step endpoint for fake/local providers.
- If the configured provider is external, direct single-step execution fails before secret resolution or network calls with `409 { requiresInspection: true }`.
- `POST /orchestration/runs/prepare` accepts the same payload as the single-step endpoint, builds the server-side context pack, estimates provider budget, and persists a paused prepared handle without calling the provider.
- `POST /orchestration/runs/:preparedRunId/execute` requires `{ confirmed: true, confirmedBy?: string }`, reloads the prepared input/context, revalidates project policy, provider settings, secret availability, budget, and freshness, then calls the provider.
- `POST /orchestration/runs/:preparedRunId/cancel` cancels the prepared handle without output artifacts or LLM call logs.

## Persistence

Prepared orchestration sends are stored as durable jobs with workflow type `orchestration.prepare`. The payload stores the original orchestration input, project id, agent run id, context pack id, provider/model inspection fields, warnings, blocking reasons, and expiry. This mirrors the writing implementation and avoids a schema migration for the first local slice.

## UI

The Agent Room gains a compact orchestration preparation control. It loads the current local project, prepares a planner run, shows provider/model, context pack, budget, warnings, blockers, exclusions, citations, and retrieval trace, then allows confirm or cancel. Confirm is disabled while blocking reasons exist.

## Safety Rules

- Prepare and cancel never call external providers.
- Execute rechecks all provider and project policy state immediately before the provider call.
- Projects with external model policy `Disabled` show a prepared blocked state and fail execute with the existing disabled-project error.
- Fake/local providers keep deterministic single-step automation, but may still use prepare/execute for UI coverage.

## Verification

- API persistence tests prove direct external orchestration requires inspection and performs zero fetch calls.
- API persistence tests prove prepare/cancel perform zero fetch calls, execute performs the provider call, and completed jobs/agent runs/LLM logs are persisted.
- Route tests prove the three new endpoints delegate to service methods and map pre-send errors to `409`.
- Component and Playwright tests prove the Agent Room can display and confirm an orchestration pre-send inspection through the local API.
