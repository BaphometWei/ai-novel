import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('retrieval evaluation API routes', () => {
  it('runs a project-backed retrieval regression without trusting browser supplied included snapshots', async () => {
    const searches: unknown[] = [];
    const app = buildApp({
      retrieval: {
        search: async (input) => {
          searches.push(input);
          return [
            {
              id: 'fact_key_location',
              projectId: input.projectId,
              type: 'canon',
              title: 'Key location',
              snippet: 'The observatory key is in the lantern.'
            },
            {
              id: 'draft_false_key',
              projectId: input.projectId,
              type: 'manuscript',
              title: 'Old draft',
              snippet: 'The key is under the mat.'
            }
          ];
        }
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/retrieval/projects/project_1/regression/run',
      payload: {
        caseId: 'retrieval_case_project',
        query: 'observatory key',
        policy: { id: 'policy_v3', description: 'V3 retrieval policy' },
        mustInclude: [
          { id: 'fact_key_location', text: 'The observatory key is in the lantern.' },
          { id: 'fact_lantern_owner', text: 'Mara keeps the lantern.' }
        ],
        forbidden: [{ id: 'draft_false_key', text: 'The key is under the mat.' }],
        maxResults: 10
      }
    });

    expect(response.statusCode).toBe(200);
    expect(searches).toEqual([{ projectId: 'project_1', query: 'observatory key', types: undefined }]);
    expect(response.json()).toEqual({
      caseId: 'retrieval_case_project',
      projectId: 'project_1',
      query: 'observatory key',
      policyId: 'policy_v3',
      passed: false,
      summary: {
        includedCount: 2,
        excludedCount: 1,
        failureCount: 2
      },
      included: [
        { id: 'fact_key_location', text: 'The observatory key is in the lantern.' },
        { id: 'draft_false_key', text: 'The key is under the mat.' }
      ],
      excluded: [{ id: 'fact_lantern_owner', reason: 'not_returned_by_project_search' }],
      failures: [
        { kind: 'must_include_missing', id: 'fact_lantern_owner' },
        { kind: 'forbidden_included', id: 'draft_false_key' }
      ]
    });

    await app.close();
  });

  it('evaluates a retrieval regression case and summarizes included, excluded, and failures', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/retrieval/regression/evaluate',
      payload: {
        caseId: 'retrieval_case_1',
        projectId: 'project_1',
        query: 'where is the observatory key',
        policy: { id: 'policy_v3', description: 'V3 retrieval policy' },
        mustInclude: [
          { id: 'fact_key_location', text: 'The observatory key is in the lantern.' },
          { id: 'fact_lantern_owner', text: 'Mara keeps the lantern.' }
        ],
        forbidden: [{ id: 'draft_false_key', text: 'The key is under the mat.' }],
        included: [
          { id: 'fact_key_location', text: 'The observatory key is in the lantern.' },
          { id: 'draft_false_key', text: 'The key is under the mat.' }
        ],
        excluded: [{ id: 'old_outline', reason: 'below similarity threshold' }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      caseId: 'retrieval_case_1',
      projectId: 'project_1',
      query: 'where is the observatory key',
      policyId: 'policy_v3',
      passed: false,
      summary: {
        includedCount: 2,
        excludedCount: 1,
        failureCount: 2
      },
      included: [
        { id: 'fact_key_location', text: 'The observatory key is in the lantern.' },
        { id: 'draft_false_key', text: 'The key is under the mat.' }
      ],
      excluded: [{ id: 'old_outline', reason: 'below similarity threshold' }],
      failures: [
        { kind: 'must_include_missing', id: 'fact_lantern_owner' },
        { kind: 'forbidden_included', id: 'draft_false_key' }
      ]
    });

    await app.close();
  });

  it('rejects invalid retrieval regression payloads', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/retrieval/regression/evaluate',
      payload: { caseId: '' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid retrieval regression payload' });

    await app.close();
  });
});
