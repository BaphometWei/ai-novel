import { describe, expect, it } from 'vitest';
import { createFixedClock } from '../shared/clock';
import { auditAuthorshipTransition } from './authorship-audit';

describe('auditAuthorshipTransition', () => {
  it('allows agent-authored prose after the draft artifact was user accepted', () => {
    const result = auditAuthorshipTransition({
      projectId: 'project_abc',
      source: { type: 'agent_run', id: 'agent_run_abc' },
      actor: { type: 'user', id: 'user_abc' },
      action: 'accept_manuscript_version',
      target: {
        draftArtifactId: 'artifact_draft_abc',
        manuscriptVersionId: 'manuscript_version_abc',
        chapterId: 'chapter_abc'
      },
      transition: { from: 'UserAccepted', to: 'ManuscriptVersion' },
      clock: createFixedClock('2026-04-27T12:00:00.000Z')
    });

    expect(result).toEqual({ allowed: true, findings: [], approvalRequests: [] });
  });

  it('flags agent-authored prose accepted without a user-accepted draft transition', () => {
    const result = auditAuthorshipTransition({
      projectId: 'project_abc',
      source: { type: 'agent_run', id: 'agent_run_abc' },
      actor: { type: 'agent', id: 'agent_abc' },
      action: 'accept_manuscript_version',
      target: {
        draftArtifactId: 'artifact_draft_abc',
        manuscriptVersionId: 'manuscript_version_abc',
        chapterId: 'chapter_abc'
      },
      transition: { from: 'DraftArtifact', to: 'ManuscriptVersion' },
      clock: createFixedClock('2026-04-27T12:00:00.000Z')
    });

    expect(result.allowed).toBe(false);
    expect(result.findings).toEqual([
      {
        code: 'DIRECT_TO_ACCEPTED_AGENT_PROSE',
        message: 'Agent-authored prose must be user accepted before becoming an accepted manuscript version',
        riskLevel: 'High',
        requiredApproval: true,
        source: { type: 'agent_run', id: 'agent_run_abc' },
        actor: { type: 'agent', id: 'agent_abc' },
        action: 'accept_manuscript_version',
        target: {
          draftArtifactId: 'artifact_draft_abc',
          manuscriptVersionId: 'manuscript_version_abc',
          chapterId: 'chapter_abc'
        },
        createdAt: '2026-04-27T12:00:00.000Z'
      }
    ]);
    expect(result.approvalRequests).toHaveLength(1);
    expect(result.approvalRequests[0]).toMatchObject({
      projectId: 'project_abc',
      targetType: 'ManuscriptVersion',
      targetId: 'manuscript_version_abc',
      riskLevel: 'High',
      reason: 'Agent-authored prose must be user accepted before becoming an accepted manuscript version',
      proposedAction: 'Review authorship audit violation before mutating canon or manuscript state'
    });
  });

  it('flags silent manuscript overwrite attempts before state is mutated', () => {
    const result = auditAuthorshipTransition({
      projectId: 'project_abc',
      source: { type: 'agent_run', id: 'agent_run_abc' },
      actor: { type: 'agent', id: 'agent_abc' },
      action: 'overwrite_manuscript_version',
      target: {
        draftArtifactId: 'artifact_draft_abc',
        manuscriptVersionId: 'manuscript_version_current',
        chapterId: 'chapter_abc'
      },
      transition: { from: 'ManuscriptVersion', to: 'ManuscriptVersion' },
      clock: createFixedClock('2026-04-27T12:00:00.000Z')
    });

    expect(result.allowed).toBe(false);
    expect(result.findings).toMatchObject([
      {
        code: 'SILENT_MANUSCRIPT_OVERWRITE',
        riskLevel: 'High',
        requiredApproval: true,
        action: 'overwrite_manuscript_version',
        target: {
          manuscriptVersionId: 'manuscript_version_current',
          chapterId: 'chapter_abc'
        },
        createdAt: '2026-04-27T12:00:00.000Z'
      }
    ]);
    expect(result.approvalRequests[0]).toMatchObject({
      targetType: 'ManuscriptVersion',
      targetId: 'manuscript_version_current',
      riskLevel: 'High',
      proposedAction: 'Review authorship audit violation before mutating canon or manuscript state'
    });
  });

  it('routes agent canon mutations to high-risk approval without mutating canon state', () => {
    const result = auditAuthorshipTransition({
      projectId: 'project_abc',
      source: { type: 'agent_run', id: 'agent_run_abc' },
      actor: { type: 'agent', id: 'agent_abc' },
      action: 'promote_canon_fact',
      target: {
        draftArtifactId: 'artifact_draft_abc',
        manuscriptVersionId: 'manuscript_version_abc',
        canonFactId: 'canon_fact_abc'
      },
      transition: { from: 'ManuscriptVersion', to: 'CanonFact' },
      clock: createFixedClock('2026-04-27T12:00:00.000Z')
    });

    expect(result.allowed).toBe(false);
    expect(result.findings).toMatchObject([
      {
        code: 'HIGH_RISK_CANON_MUTATION',
        riskLevel: 'High',
        requiredApproval: true,
        source: { type: 'agent_run', id: 'agent_run_abc' },
        actor: { type: 'agent', id: 'agent_abc' },
        action: 'promote_canon_fact',
        createdAt: '2026-04-27T12:00:00.000Z'
      }
    ]);
    expect(result.approvalRequests[0]).toMatchObject({
      targetType: 'CanonFact',
      targetId: 'canon_fact_abc',
      riskLevel: 'High'
    });
  });
});
