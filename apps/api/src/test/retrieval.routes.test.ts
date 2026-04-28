import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('retrieval evaluation API routes', () => {
  it('exposes synthetic local quality thresholds for retrieval evaluation', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'GET',
      url: '/retrieval/quality-thresholds'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      source: 'synthetic-local-defaults',
      retrieval: {
        requiredCoverage: 1,
        forbiddenLeakage: 0
      }
    });

    await app.close();
  });

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
        thresholds: {
          requiredCoverage: 0.5,
          forbiddenLeakage: 0.5
        },
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
      thresholds: {
        requiredCoverage: 0.5,
        forbiddenLeakage: 0.5
      },
      includedIds: ['fact_key_location', 'draft_false_key'],
      excludedIds: ['fact_lantern_owner'],
      triageHints: [
        {
          itemId: 'fact_lantern_owner',
          severity: 'blocking',
          message: 'Required retrieval item fact_lantern_owner was excluded: not_returned_by_project_search.'
        },
        {
          itemId: 'draft_false_key',
          severity: 'blocking',
          message: 'Forbidden retrieval item draft_false_key was included in context.'
        }
      ],
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
        thresholds: {
          requiredCoverage: 0.5,
          forbiddenLeakage: 0.5
        },
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
      thresholds: {
        requiredCoverage: 0.5,
        forbiddenLeakage: 0.5
      },
      includedIds: ['fact_key_location', 'draft_false_key'],
      excludedIds: ['old_outline'],
      triageHints: [
        {
          itemId: 'fact_lantern_owner',
          severity: 'blocking',
          message: 'Required retrieval item fact_lantern_owner was missing from included context.'
        },
        {
          itemId: 'draft_false_key',
          severity: 'blocking',
          message: 'Forbidden retrieval item draft_false_key was included in context.'
        }
      ],
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

  it('rejects invalid quality threshold overrides', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/retrieval/regression/evaluate',
      payload: {
        caseId: 'retrieval_case_bad_threshold',
        projectId: 'project_1',
        query: 'observatory key',
        policy: { id: 'policy_v3' },
        mustInclude: [],
        forbidden: [],
        included: [],
        excluded: [],
        thresholds: {
          requiredCoverage: 2,
          forbiddenLeakage: 0
        }
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid retrieval regression payload' });

    await app.close();
  });
});
