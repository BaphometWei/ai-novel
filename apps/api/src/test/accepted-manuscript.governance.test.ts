import type { ProviderAdapter } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

function fakeProvider(): ProviderAdapter {
  return {
    name: 'fake',
    async generateText() {
      return {
        text: 'The city crown is destroyed, changing canon.',
        usage: { inputTokens: 10, outputTokens: 8 }
      };
    },
    async generateStructured<T>() {
      return {
        value: { summary: 'The draft follows the contract.', passed: true, findings: [] } as T,
        usage: { inputTokens: 4, outputTokens: 3 }
      };
    },
    async *streamText() {
      yield 'unused';
    },
    async embedText() {
      return { vector: [0.1], model: 'fake-embedding' };
    },
    estimateCost(input) {
      return { estimatedUsd: (input.inputTokens + input.outputTokens) / 1_000_000 };
    }
  };
}

describe('accepted manuscript governance', () => {
  it('accepts an agent draft as pending governance and creates approval queue items', async () => {
    const runtime = await createPersistentApiRuntime(':memory:', {
      fallbackProvider: fakeProvider()
    });

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Seed Project',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });
    const project = projectResponse.json();

    const chapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/chapters`,
      payload: {
        title: 'Chapter 1',
        order: 1,
        body: 'Initial draft.',
        status: 'Draft'
      }
    });
    const { chapter } = chapterResponse.json();

    const runResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/writing-runs`,
      payload: {
        target: {
          manuscriptId: chapter.manuscriptId,
          chapterId: chapter.id,
          range: 'chapter_1'
        },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft a canon-changing scene',
          mustWrite: 'Destroy the city crown.',
          wordRange: { min: 100, max: 400 },
          forbiddenChanges: ['Do not silently promote canon'],
          acceptanceCriteria: ['Requires governance']
        },
        retrieval: { query: 'city crown' }
      }
    });
    const run = runResponse.json();

    const acceptance = await runtime.app.inject({
      method: 'POST',
      url: `/chapters/${chapter.id}/accept-draft`,
      payload: {
        runId: run.agentRunId,
        draftArtifactId: run.draftArtifact.artifactRecordId,
        body: run.draftArtifact.text,
        acceptedBy: 'operator'
      }
    });

    expect(acceptance.statusCode).toBe(202);
    expect(acceptance.json()).toMatchObject({
      status: 'PendingApproval',
      chapterId: chapter.id,
      sourceRunId: run.agentRunId,
      approvals: [expect.objectContaining({ status: 'Pending', riskLevel: 'High' })]
    });
    expect(acceptance.json().versionId).toMatch(/^manuscript_version_/);

    const queue = await runtime.app.inject({ method: 'GET', url: `/approvals?projectId=${project.id}` });
    expect(queue.statusCode).toBe(200);
    expect(queue.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: project.id,
          targetType: 'memory_candidate_fact',
          status: 'Pending'
        })
      ])
    );

    const approvalId = acceptance.json().approvals[0].id;
    const approval = await runtime.app.inject({
      method: 'POST',
      url: `/approvals/${approvalId}/approve`,
      payload: { decidedBy: 'operator', note: 'canon approved' }
    });
    const chapters = await runtime.app.inject({ method: 'GET', url: `/projects/${project.id}/chapters` });
    const canonRows = await runtime.database.client.execute(
      `SELECT text, status, source_references_json FROM canon_facts WHERE project_id = '${project.id}'`
    );
    const candidateRows = await runtime.database.client.execute(
      `SELECT status FROM memory_candidate_facts WHERE approval_request_id = '${approvalId}'`
    );

    expect(approval.statusCode).toBe(200);
    expect(approval.json()).toMatchObject({ id: approvalId, status: 'Approved', decidedBy: 'operator' });
    expect(chapters.json()[0]).toMatchObject({
      currentVersionId: acceptance.json().versionId,
      versions: expect.arrayContaining([
        expect.objectContaining({
          id: acceptance.json().versionId,
          status: 'Accepted',
          metadata: expect.objectContaining({ governanceStatus: 'Approved' })
        })
      ])
    });
    expect(canonRows.rows).toEqual([
      expect.objectContaining({
        text: 'The city crown is destroyed, changing canon.',
        status: 'Canon'
      })
    ]);
    expect(String(canonRows.rows[0].source_references_json)).toContain(acceptance.json().versionId);
    expect(candidateRows.rows).toEqual([expect.objectContaining({ status: 'Promoted' })]);

    runtime.database.client.close();
    await runtime.app.close();
  });

  it('rejects accepting a draft when artifact text provenance is tampered', async () => {
    const runtime = await createPersistentApiRuntime(':memory:', {
      fallbackProvider: fakeProvider()
    });

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Seed Project',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });
    const project = projectResponse.json();
    const chapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/chapters`,
      payload: { title: 'Chapter 1', order: 1, body: 'Initial draft.', status: 'Draft' }
    });
    const { chapter } = chapterResponse.json();
    const runResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/writing-runs`,
      payload: {
        target: { manuscriptId: chapter.manuscriptId, chapterId: chapter.id, range: 'chapter_1' },
        contract: {
          authorshipLevel: 'A3',
          goal: 'Draft a canon-changing scene',
          mustWrite: 'Destroy the city crown.',
          wordRange: { min: 100, max: 400 },
          forbiddenChanges: ['Do not silently promote canon'],
          acceptanceCriteria: ['Requires governance']
        },
        retrieval: { query: 'city crown' }
      }
    });
    const run = runResponse.json();

    const acceptance = await runtime.app.inject({
      method: 'POST',
      url: `/chapters/${chapter.id}/accept-draft`,
      payload: {
        runId: run.agentRunId,
        draftArtifactId: run.draftArtifact.artifactRecordId,
        body: `${run.draftArtifact.text} Tampered extra sentence.`,
        acceptedBy: 'operator'
      }
    });

    expect(acceptance.statusCode).toBe(409);
    expect(acceptance.json()).toMatchObject({ error: 'Draft provenance mismatch' });

    runtime.database.client.close();
    await runtime.app.close();
  });
});
