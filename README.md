# AI Novel

Local-first AI novel workspace for manuscript planning, retrieval, revision, and production workflow experiments.

## Production Hardening Handoff

External production-readiness blockers are tracked in [docs/operations/external-blockers.md](docs/operations/external-blockers.md). They cover the real OpenAI-compatible API key and model budget approval, GitHub repository secrets for CI real-provider smoke tests, desktop code signing and release channel decisions, OS keychain/secret storage selection, and representative manuscript quality thresholds.

Current deterministic/local tests avoid paid model calls and do not include real secrets.

## Resume Locally

```bash
git switch codex/production-hardening
npm run verify:local
```
