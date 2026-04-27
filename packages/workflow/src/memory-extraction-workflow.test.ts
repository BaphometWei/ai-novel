import { describe, expect, it, vi } from 'vitest';
import { extractMemoryFromAcceptedText, type MemoryExtractionDependencies } from './memory-extraction-workflow';

function dependencies(): MemoryExtractionDependencies & {
  savedCandidates: unknown[];
  savedApprovalRequests: unknown[];
} {
  const savedCandidates: unknown[] = [];
  const savedApprovalRequests: unknown[] = [];

  return {
    clock: () => '2026-04-27T09:30:00.000Z',
    createId: (prefix) => `${prefix}_test`,
    extractor: {
      extract: vi.fn(async () => [
        {
          text: 'The bell is alive.',
          kind: 'WorldRule',
          confidence: 0.92,
          riskLevel: 'High',
          evidence: 'The bell is alive.'
        }
      ])
    },
    repository: {
      saveCandidate: vi.fn(async (candidate) => {
        savedCandidates.push(candidate);
      }),
      saveApprovalRequest: vi.fn(async (request) => {
        savedApprovalRequests.push(request);
      })
    },
    savedCandidates,
    savedApprovalRequests
  };
}

describe('extractMemoryFromAcceptedText', () => {
  it('extracts candidate memory only from accepted manuscript text and sends high-risk canon changes to approvals', async () => {
    const deps = dependencies();

    const result = await extractMemoryFromAcceptedText(
      {
        projectId: 'project_abc',
        source: {
          kind: 'AcceptedManuscriptText',
          manuscriptVersionId: 'version_abc',
          text: 'The bell is alive.'
        }
      },
      deps
    );

    expect(deps.extractor.extract).toHaveBeenCalledWith({
      projectId: 'project_abc',
      manuscriptVersionId: 'version_abc',
      acceptedText: 'The bell is alive.'
    });
    expect(result.candidates).toEqual([
      expect.objectContaining({
        id: 'memory_candidate_test',
        projectId: 'project_abc',
        manuscriptVersionId: 'version_abc',
        text: 'The bell is alive.',
        status: 'Candidate',
        sourceKind: 'AcceptedManuscriptText'
      })
    ]);
    expect(result.approvalRequests).toEqual([
      expect.objectContaining({
        id: 'approval_request_test',
        projectId: 'project_abc',
        candidateId: 'memory_candidate_test',
        riskLevel: 'High',
        status: 'Pending',
        requestedAction: 'PromoteMemoryCandidateToCanon'
      })
    ]);
    expect(deps.savedCandidates).toEqual(result.candidates);
    expect(deps.savedApprovalRequests).toEqual(result.approvalRequests);
  });

  it('rejects draft or agent text before extraction or persistence', async () => {
    for (const source of [
      {
        kind: 'DraftArtifactText' as const,
        artifactId: 'artifact_draft',
        text: 'The bell might be alive if the author accepts this.'
      },
      {
        kind: 'AgentGeneratedText' as const,
        agentRunId: 'agent_run_draft',
        text: 'The agent suggests the bell might be alive.'
      }
    ]) {
      const deps = dependencies();

      await expect(
        extractMemoryFromAcceptedText(
          {
            projectId: 'project_abc',
            source
          },
          deps
        )
      ).rejects.toThrow(/accepted manuscript text/i);

      expect(deps.extractor.extract).not.toHaveBeenCalled();
      expect(deps.repository.saveCandidate).not.toHaveBeenCalled();
      expect(deps.repository.saveApprovalRequest).not.toHaveBeenCalled();
    }
  });
});
