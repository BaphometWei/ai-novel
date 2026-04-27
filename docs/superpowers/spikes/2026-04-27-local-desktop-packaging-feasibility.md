# Local Desktop Packaging Feasibility Spike

Date: 2026-04-27

## Scope

This spike evaluates whether the V3 local-first AI Novel Agent should proceed toward desktop packaging, and which packaging path best fits the existing design.

In scope:

- Electron shell around the existing React/Vite frontend and Node/Fastify API.
- Tauri shell around the existing frontend with local sidecar or embedded API process options.
- Continuing as a local web app with packaging deferred.
- Local data storage, SQLite, artifacts, secrets, dev/prod server model, updates, and operational risks.

Out of scope:

- Cloud sync.
- Multi-user collaboration.
- Plugin marketplace.
- External platform publishing connectors.
- App store distribution, public installer publishing, code-signing procurement, or auto-update rollout.
- Changing the V3 stack away from React, Vite, TypeScript, Node, Fastify, Drizzle, SQLite WAL, and local artifacts.

## Design Constraints

The full system design positions the product as a local Web workspace with front-end plus API modules and clean extension boundaries for desktop packaging. It also requires local-first storage, provider-agnostic model access, durable jobs, replayable agent runs, traceability, local API-key protection, and inspectable external model context.

The V3 plan explicitly treats desktop packaging as a feasibility spike, not a full V3 deliverable. V3 should continue to prioritize advanced retrieval, narrative intelligence, governance, observability, backup scheduling, and migration management.

Any desktop packaging approach must preserve these constraints:

- SQLite remains the local source of truth for relational state.
- Artifacts remain versioned, hashed, and portable.
- Vector indexes store embeddings and references only, not source text truth.
- High-risk canon, source-policy, branch, retcon, restore, and publication decisions remain user-approved.
- The desktop shell must not introduce hidden cloud services or external publishing behavior.
- The domain core must remain independent of UI, database implementation, and model provider.

## Option 1: Electron

Electron is highly feasible for this architecture because the current backend is already Node-based. The production desktop app can run the Vite-built frontend in a BrowserWindow and start the existing Fastify API as an internal local process or imported Node module.

Strengths:

- Best fit for the current Node/Fastify API without rewriting runtime code.
- Mature packaging ecosystem for Windows, macOS, and Linux.
- Straightforward access to filesystem paths for SQLite database files, artifacts, import/export bundles, and backups.
- Easier reuse of existing npm workspace tooling and TypeScript build outputs.
- Background jobs can continue to run in Node with fewer platform surprises.

Costs and risks:

- Larger installer and memory footprint.
- More security hardening is required: disable Node integration in renderer, use context isolation, restrict IPC, and bind API only to loopback or internal channels.
- Auto-update and code signing become product work, not just engineering work.
- Need careful process lifecycle handling so the API, job worker, database connections, and shutdown hooks close cleanly.

Fit: Good near-term technical fit, but still more than a small wrapper if the app is expected to feel production-grade.

## Option 2: Tauri

Tauri is feasible for the frontend shell, but the current Node/Fastify backend makes it less direct. The app would either run the API as a sidecar Node process or require a future backend bridge/rewrite.

Strengths:

- Smaller binary and lower baseline memory usage than Electron.
- Strong native shell and security posture when commands are narrowly exposed.
- Good fit if the long-term product wants a thin native host around a web UI.

Costs and risks:

- The existing API is not Rust-native. A sidecar Node process would still need bundling, lifecycle management, port negotiation, logging, crash recovery, and update compatibility.
- Native build toolchains add platform friction for contributors.
- SQLite and artifact filesystem access are fine, but ownership is split between Rust shell and Node sidecar unless the backend is rewritten or narrowed.
- More architectural work is needed before Tauri would be simpler than Electron.

Fit: Plausible later, especially if native footprint becomes important, but not the lowest-risk next step for the current V3 codebase.

## Option 3: Local Web App Extension

The current local web app remains the lowest-risk product path for V3. It keeps the API and UI in their designed shape, avoids native packaging complexity, and still supports local-first author workflows.

Strengths:

- Preserves current architecture with the fewest new moving parts.
- Keeps V3 focused on intelligence, governance, persistence, backup, observability, and migration work.
- Local SQLite, artifacts, import/export, and backups can mature before being wrapped by a desktop shell.
- Easier to verify with existing Vitest, Playwright, API, DB check, and browser workflows.

Costs and risks:

- Users must start or install a local server instead of opening a single desktop app.
- Secret storage is limited to the current local configuration approach unless a native credential store is added later.
- OS-level file associations, tray behavior, background startup, and native update flows remain unavailable.

Fit: Best fit for completing V3 without widening scope.

## Data Storage

All packaging options should keep the same storage model:

- SQLite with WAL for relational identity, relationships, state, metadata, version pointers, durable jobs, migration history, settings, and observability.
- Versioned artifacts for large text, generated outputs, context packs, reports, diffs, imports, exports, and project bundles.
- SQLite FTS for precise local search.
- Local vector store behind the retrieval adapter, storing embedding metadata and references only.
- Portable project bundle as the backup/restore boundary.

Desktop packaging should standardize an app data layout but not change domain semantics:

- `projects/<projectId>/project.sqlite`
- `projects/<projectId>/artifacts/<hash-or-version-path>`
- `projects/<projectId>/exports/`
- `projects/<projectId>/backups/`
- `logs/` with sensitive content excluded
- `settings/` for non-secret local preferences

The exact root should use the OS app data directory in packaged builds and a repo-local development path in dev builds.

## SQLite and Artifacts

SQLite is compatible with Electron, Tauri sidecar, and local web operation. The main packaging concerns are operational:

- Ensure one writer/process owns the database at a time.
- Keep WAL files colocated with the database and included in safe shutdown/backup rules.
- Run migrations before opening the app workspace, with migration history visible in V3 observability.
- Keep backup jobs non-overlapping and verify restore integrity before reporting success.
- Avoid storing source text inside vector indexes; store source references and metadata only.
- Keep artifact hashes stable across local web and packaged desktop modes.

For packaged desktop, the API process should remain the single database owner. The renderer should never access SQLite files directly.

## Secret Handling

The design requires API keys to be local and protected, and sensitive content must not be written into ordinary logs.

Minimum viable local web handling:

- Store provider keys outside project bundles by default.
- Redact keys and sensitive prompts from logs.
- Keep settings export explicit about whether secrets are excluded.
- Let users inspect external model context before sending.

Desktop packaging can improve this later:

- Electron can use OS keychain libraries through the main process.
- Tauri can use a native keyring plugin or command.
- The renderer should never receive raw secrets after initial entry.
- Project bundles should include provider configuration names, not secret values.

Secret storage is a reason to prefer eventual desktop packaging, but not enough to justify full packaging before V3 persistence, backup, and migration behavior stabilizes.

## Dev and Production Server Model

Recommended development model:

- Run Vite dev server for the frontend.
- Run Fastify API on a local development port.
- Use explicit local environment settings for database path and artifact root.

Recommended Electron production model if packaging proceeds:

- Build the frontend with Vite and load static assets in BrowserWindow.
- Start the Fastify API in the Electron main process or as a managed child process.
- Bind API to an ephemeral loopback port, or prefer an internal IPC bridge for privileged operations.
- Keep renderer sandboxed and route privileged actions through a narrow bridge.
- Start durable workers under API ownership, not renderer ownership.

Recommended Tauri production model if packaging proceeds:

- Load Vite-built frontend in the Tauri webview.
- Run the existing Node/Fastify API as a managed sidecar until there is a deliberate backend redesign.
- Keep filesystem, secret, and update commands narrow and auditable.

The local web model should remain the canonical development and test path until a packaging spike becomes an implementation project.

## Update Strategy

Updates should stay manual or repo-based during V3.

Before native auto-update is considered, the project needs:

- Stable migration history and rollback/restore verification.
- Backup-before-update behavior for local project databases.
- Compatibility checks for SQLite schema, artifacts, vector records, and project bundles.
- Clear separation between app updates and project data migrations.
- Code signing and release channel decisions.

Electron and Tauri both have update mechanisms, but adopting either now would create product, release, and support obligations outside the V3 scope.

## Risks

- Packaging too early can distract from V3's core intelligence and governance work.
- Native shells create two lifecycle domains: app shell and local API/job runtime.
- Database corruption risk increases if multiple processes can access SQLite directly.
- Auto-update can break local projects unless migrations and backups are mature.
- Secret storage can become inconsistent across local web and packaged modes.
- Tauri sidecar packaging may look small but still carries Node runtime and API lifecycle complexity.
- Electron is technically direct but increases installer size and security hardening work.
- Cross-platform paths, file permissions, and antivirus behavior can affect SQLite, WAL, artifacts, backups, and model-provider settings.

## Recommendation

Desktop packaging should remain a feasibility-only item for V3 and proceed later, after V3 persistence, observability, migration history, scheduled backup, and restore verification are stable.

If packaging is approved after V3, Electron should be the first implementation spike because it fits the existing Node/Fastify backend with the least architectural change. The spike should produce a private local build only, with no cloud sync, collaboration, marketplace, external publishing, app store release, or public auto-update.

Tauri should stay as a later comparison path if installer size, memory footprint, or native-shell constraints become more important than backend reuse.

Practical next step: finish V3 as a robust local web workspace, then run a focused Electron prototype that proves static frontend loading, managed API lifecycle, SQLite/artifact path selection, OS keychain integration, backup-before-migration, and clean shutdown.
