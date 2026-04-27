import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerMemoryRoutes, type MemoryRouteDependencies } from '../routes/memory.routes';

function createDeps(): MemoryRouteDependencies & {
  extractedInputs: unknown[];
  savedCandidates: unknown[];
  savedApprovalRequests: unknown[];
} {
  const extractedInputs: unknown[] = [];
  const savedCandidates: unknown[] = [];
  const savedApprovalRequests: unknown[] = [];

  return {
    extractedInputs,
    savedCandidates,
    savedApprovalRequests,
    extractor: {
      extract(input) {
        extractedInputs.push(input);
        return [
          {
            text: 'Mira carries the brass compass.',
            kind: 'CharacterFact',
            confidence: 0.92,
            riskLevel: 'Low',
            evidence: 'Mira tucked the brass compass into her coat.'
          },
          {
            text: 'The gate opens only during the eclipse.',
            kind: 'WorldRule',
            confidence: 0.88,
            riskLevel: 'High',
            evidence: 'No one could open the gate except under eclipse-light.'
          }
        ];
      }
    },
    clock: () => '2026-04-27T00:00:00.000Z',
    createId: (prefix) => `${prefix}_test`,
    repository: {
      saveCandidate(candidate) {
        savedCandidates.push(candidate);
      },
      saveApprovalRequest(request) {
        savedApprovalRequests.push(request);
      }
    }
  };
}

describe('memory extraction API routes', () => {
  it('extracts memory candidates from accepted manuscript text and creates approval requests without canon promotion', async () => {
    const app = Fastify();
    const deps = createDeps();
    registerMemoryRoutes(app, deps);

    const response = await app.inject({
      method: 'POST',
      url: '/projects/project_alpha/memory/extractions',
      payload: {
        source: {
          kind: 'AcceptedManuscriptText',
          manuscriptVersionId: 'manuscript_version_1',
          text: 'Mira tucked the brass compass into her coat.'
        }
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      candidates: [
        {
          id: 'memory_candidate_test',
          projectId: 'project_alpha',
          manuscriptVersionId: 'manuscript_version_1',
          sourceKind: 'AcceptedManuscriptText',
          status: 'Candidate',
          text: 'Mira carries the brass compass.',
          riskLevel: 'Low'
        },
        {
          id: 'memory_candidate_test',
          projectId: 'project_alpha',
          manuscriptVersionId: 'manuscript_version_1',
          sourceKind: 'AcceptedManuscriptText',
          status: 'Candidate',
          text: 'The gate opens only during the eclipse.',
          riskLevel: 'High'
        }
      ],
      approvalRequests: [
        {
          id: 'approval_request_test',
          projectId: 'project_alpha',
          candidateId: 'memory_candidate_test',
          manuscriptVersionId: 'manuscript_version_1',
          riskLevel: 'High',
          status: 'Pending',
          requestedAction: 'PromoteMemoryCandidateToCanon'
        }
      ]
    });
    expect(deps.extractedInputs).toEqual([
      {
        projectId: 'project_alpha',
        manuscriptVersionId: 'manuscript_version_1',
        acceptedText: 'Mira tucked the brass compass into her coat.'
      }
    ]);
    expect(deps.savedCandidates).toHaveLength(2);
    expect(deps.savedApprovalRequests).toHaveLength(1);

    await app.close();
  });

  it('rejects draft and agent generated text without calling the extractor or store', async () => {
    for (const source of [
      { kind: 'DraftArtifactText', artifactId: 'artifact_1', text: 'draft' },
      { kind: 'AgentGeneratedText', agentRunId: 'agent_run_1', text: 'agent output' }
    ] as const) {
      const app = Fastify();
      const deps = createDeps();
      registerMemoryRoutes(app, deps);

      const response = await app.inject({
        method: 'POST',
        url: '/projects/project_alpha/memory/extractions',
        payload: { source }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'Memory extraction requires accepted manuscript text' });
      expect(deps.extractedInputs).toEqual([]);
      expect(deps.savedCandidates).toEqual([]);
      expect(deps.savedApprovalRequests).toEqual([]);

      await app.close();
    }
  });
});
