# Local Recovery Runbook

Date: 2026-04-28

## Purpose

Use this runbook to recover a local ai-novel workspace after a bad local change, failed restore, interrupted backup, damaged SQLite database, or suspicious artifact state. It is intentionally local-first and does not require paid provider calls or real secrets.

## Prerequisites And Safety

- Work from a known repository checkout and record the current branch and commit before touching data:

```powershell
git status --short --branch
git log --oneline -1
```

- Stop running API, web, worker, and Playwright processes before copying or restoring database files.
- Do not delete the original database, backup bundle, WAL file, SHM file, artifact directory, or log directory during recovery. Move copies into a dated quarantine directory instead.
- Keep provider API keys, signing credentials, and private manuscript material out of screenshots, tickets, chat transcripts, and public logs.
- Prefer restore into a new target project id first. Replace-in-place restores require explicit operator approval and a rollback record.

## Locate Runtime Data

Confirm the configured database and artifact locations from local environment files and runtime settings. Common local targets include SQLite database files, `-wal` and `-shm` sidecars, backup/export bundles, generated artifacts, and Playwright reports.

```powershell
rg "DATABASE|SQLITE|ARTIFACT|BACKUP|EXPORT" .env* apps packages scripts
rg "backup|restore|artifact" apps packages scripts docs
```

If any path contains secrets or private manuscript excerpts, treat it as confidential.

## SQLite Health Checks

Run read-only SQLite checks against a copy when possible. If checking the live file is unavoidable, stop all local processes first.

```powershell
sqlite3 path\to\workspace.db "PRAGMA quick_check;"
sqlite3 path\to\workspace.db "PRAGMA integrity_check;"
sqlite3 path\to\workspace.db "PRAGMA wal_checkpoint(PASSIVE);"
```

Expected results:

- `quick_check` returns `ok`.
- `integrity_check` returns `ok`.
- `wal_checkpoint(PASSIVE)` completes without truncating needed WAL content.

If integrity checks fail, do not run write commands against the damaged database. Preserve the database, WAL, and SHM files as evidence and restore from the newest verified backup.

## Start Local Services

After database and artifact paths are safe, start the local app using repository scripts:

```powershell
npm install
npm run dev:api
npm run dev:web
```

Use package-specific workspace scripts only if the root aliases are unavailable:

```powershell
npm --workspace @ai-novel/api run dev
npm --workspace @ai-novel/web run dev
```

Keep terminal output local. Redact provider keys, bearer tokens, manuscript excerpts, and generated model output before sharing logs.

## Full Verification

Run the full local verification path after recovery, restore, or rollback:

```powershell
npm run verify:local
```

Expected result: the command exits with code 0 and reports no failed tests. This command runs unit tests, build, DB checks, the local production-like rehearsal, and Playwright. If the script prints package-level summaries instead of a single success line, confirm each build, database check, rehearsal, Vitest run, and Playwright run completed successfully.

Run the production-like rehearsal by itself when validating only local recovery mechanics:

```powershell
npm run rehearse:local-production
```

The rehearsal script creates a temporary workspace, runs a real SQLite-backed API flow, creates a project and chapter, creates a backup, verifies it, restores it into a new project, checks the restored project, and removes the temporary workspace after the Vitest child process exits.

Focused read-only documentation checks can verify that recovery and blocker notes are present:

```powershell
rg "Local Recovery Runbook|SQLite|restore rehearsal|rollback metadata|secret" docs/operations/recovery.md
rg "later sync|transport note|1727d5f|committed|push" docs/operations docs/superpowers/plans/2026-04-28-agent-system-completion.md
```

## Backup Procedure

Before risky operations, create a dated local backup directory and copy data into it.

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = "backups\manual-$stamp"
New-Item -ItemType Directory -Force -Path $backupRoot
```

For SQLite databases using WAL mode, copy the database file and both sidecars together while services are stopped:

- `workspace.db`
- `workspace.db-wal`
- `workspace.db-shm`

If services cannot be stopped, use the application backup/export workflow or SQLite's online backup support instead of copying a hot database file by itself.

## Artifact Copy Rules

- Copy artifacts by directory, preserving relative paths and filenames referenced by bundle manifests or database rows.
- Do not rename files inside a bundle unless the manifest is regenerated and hashes are reverified.
- Keep generated drafts, review reports, imports, exports, backups, and restore logs with their metadata files.
- Never copy provider secret files into backup bundles unless an operator has explicitly approved secret inclusion for a private destination.
- When moving evidence for debugging, copy the smallest needed artifact set and redact private prose before sharing.

## Backup Verification

Verify every backup before trusting it:

- Confirm the bundle manifest exists and names all expected sections.
- Check section hashes against the manifest.
- Confirm artifact paths referenced in metadata exist in the copied artifact directory.
- Confirm portable project backup bundles include the artifact content needed by restored manuscript, context-pack, report, and generated-output records.
- For portability checks, restore into a workspace with a different artifact root and verify restored chapter body text and artifact-backed records load without access to the source artifact root.
- Run SQLite `quick_check` and `integrity_check` on copied database files when the backup includes raw SQLite.
- Record the source commit, source project id, backup path, created timestamp, requester, and verification result.
- For project backups, confirm unrelated project artifacts and runs are absent from the backup envelope.

## Restore Rehearsal

Rehearse restore into an isolated target project before replacing existing data:

1. Start from a clean local process state with API and workers stopped.
2. Preserve the current database, WAL, SHM, artifacts, and logs.
3. Restore the backup into a new target project id.
4. Start local services.
5. Confirm the restored project opens, manuscripts load, artifacts resolve, approvals are visible, durable jobs have expected status, and observability summaries do not invent missing data.
6. For portable project backups, confirm artifact content was restored under the target artifact root rather than read from the source root.
7. Confirm the restore record includes rollback actions, especially `delete_project` for new-target rehearsal restores.
8. Confirm unrelated projects still load with their original chapters and artifact references.
9. Run `npm run rehearse:local-production` for a focused rehearsal or `npm run verify:local` for the full local gate.
10. Record rehearsal outcome and any manual fixes.

Only after a successful rehearsal should an operator approve a replace-in-place restore.

These local portability checks increase confidence in backup and restore mechanics, but they do not complete production disaster recovery. Production readiness still requires approved infrastructure, off-host retention, credential handling, monitoring, restore objectives, and operator rehearsal policy.

## Migration Failure Recovery

If a migration fails locally:

1. Stop API, web, worker, and test processes.
2. Preserve the database, WAL, SHM, artifact directory, and migration logs in a dated quarantine directory.
3. Restore the newest verified pre-migration database copy and its sidecars together.
4. Run `npm run db:check`.
5. Run `npm run rehearse:local-production` to confirm migrations and local recovery flows can still run against a temporary workspace.
6. Re-run the failed migration only after the error is understood and a new local backup exists.
7. If the migration partially wrote rows before failing, compare the quarantine copy with the restored database before deleting anything.

## Rollback Metadata

Every restore or rollback should leave enough metadata for a future operator to understand what happened:

- Operator/requester.
- Timestamp and local timezone.
- Source commit and current branch.
- Source project id and target project id.
- Backup path or bundle id.
- Manifest hash and section hashes.
- Files copied, including database, WAL, SHM, artifacts, logs, and reports.
- Restore mode: rehearsal, new-target restore, replace-in-place, or rollback.
- Rollback actions created for inserted or replaced rows/files.
- Verification commands and results.
- Known gaps, skipped sections, or external blockers.

## Rollback Steps

If a recovery attempt makes the local state worse:

1. Stop API, web, worker, and test processes.
2. Preserve the failed recovery state in a dated quarantine directory.
3. Restore the last verified database, WAL, SHM, and artifact directory together.
4. Re-run SQLite health checks.
5. Start services and inspect the restored project.
6. Run `npm run verify:local`.
7. Append rollback metadata to the local recovery notes or operation ticket.

## Secret And Log Safety

- Do not paste raw `.env` files, bearer tokens, API keys, signed URLs, private manuscript excerpts, or generated provider output into public systems.
- Redact long secret-looking strings from errors before sharing.
- Keep CI, Playwright, API, and provider logs private unless redaction has been reviewed.
- If a secret appears in a copied artifact, backup, report, or log, rotate it and mark affected files as sensitive.
- Real-provider smoke tests remain blocked until credentials, model budget, CI secret policy, and log redaction expectations are approved.
