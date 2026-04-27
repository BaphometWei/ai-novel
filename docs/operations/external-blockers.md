# Production Hardening External Blockers

Date: 2026-04-28

## Purpose

This handoff lists production-readiness decisions that require operator or product owner input before the project can be treated as production hardened. These are intentionally external blockers: current deterministic and local tests avoid paid model calls and do not include real secrets.

## Blockers

### OpenAI-Compatible Provider Access

- Provide a real OpenAI-compatible API key for smoke testing and production validation.
- Approve the model budget, including which models may be used, expected per-run cost ceiling, and who owns spend monitoring.
- Confirm whether tests should call OpenAI directly or another OpenAI-compatible provider.

### GitHub Repository Secrets

- Add GitHub repository secrets for CI real-provider smoke tests.
- Confirm secret names, allowed branches, and whether those smoke tests run on every protected branch, scheduled jobs, manual dispatch, or release candidates only.
- Ensure CI logs redact provider keys, prompts, manuscript excerpts, and generated model output that should not be public.

### Desktop Packaging Decisions

- Decide whether the first production desktop package targets Electron, Tauri, or another release path.
- Choose release channels such as internal, alpha, beta, stable, and whether auto-update is in scope.
- Provide code signing decisions and credentials for each target OS before publishing installers or update artifacts.

### OS Keychain and Secret Storage

- Select the secret storage library for local provider keys and other credentials.
- Confirm supported OS targets and fallback behavior when the OS keychain is unavailable.
- Decide whether project export, backup, and diagnostics must always exclude secrets or support explicit operator-approved inclusion.

### Manuscript Corpus and Quality Thresholds

- Provide a representative manuscript corpus for validation.
- Define quality thresholds for retrieval, continuity, canon safety, generated prose review, and regression acceptance.
- Confirm whether the validation corpus may be used in CI, local-only evaluation, or private release candidate checks.

## Local Resume Commands

```bash
git switch codex/production-hardening
npm run verify:local
```

## Current Test Boundary

The current deterministic/local verification path is intended to be safe for local development. It avoids paid model calls and does not require or include real provider secrets. Real-provider smoke tests should remain blocked until the API key, model budget, repository secrets, and logging/redaction expectations above are approved.
