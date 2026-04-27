import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';
import { configurePersistentBranchRetconRouteStore, type BranchRetconRouteStore } from '../routes/branch-retcon.routes';

describe('branch and retcon API routes', () => {
  it('projects a branch scenario without mutating canon', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/branch-retcon/branches/project',
      payload: {
        canon: { canonFactIds: ['fact_1'], artifactIds: ['chapter_1'] },
        scenario: {
          projectId: 'project_1',
          title: 'Mira keeps the key',
          baseCanonFactIds: ['fact_1'],
          artifacts: [{ id: 'branch_chapter_2', kind: 'chapter', content: 'Mira keeps the observatory key.' }]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      scenario: {
        projectId: 'project_1',
        title: 'Mira keeps the key',
        baseCanonFactIds: ['fact_1'],
        artifacts: [{ id: 'branch_chapter_2', kind: 'chapter', content: 'Mira keeps the observatory key.' }]
      },
      projection: {
        canon: { canonFactIds: ['fact_1'], artifactIds: ['chapter_1'] },
        projectedArtifacts: [{ id: 'branch_chapter_2', kind: 'chapter', content: 'Mira keeps the observatory key.' }],
        canonChanged: false
      }
    });
    expect(response.json().scenario.id).toMatch(/^branch_scenario_/);

    await app.close();
  });

  it('adopts a branch scenario into the canon artifact list', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/branch-retcon/branches/adopt',
      payload: {
        canon: { canonFactIds: ['fact_1'], artifactIds: ['chapter_1'] },
        scenario: {
          id: 'branch_scenario_existing',
          projectId: 'project_1',
          title: 'Mira keeps the key',
          baseCanonFactIds: ['fact_1'],
          artifacts: [{ id: 'branch_chapter_2', kind: 'chapter', content: 'Mira keeps the observatory key.' }]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      canon: {
        canonFactIds: ['fact_1'],
        artifactIds: ['chapter_1', 'branch_chapter_2']
      }
    });

    await app.close();
  });

  it('creates a retcon proposal with impact and pending regression checks', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/branch-retcon/retcons/propose',
      payload: {
        projectId: 'project_1',
        target: { type: 'CanonFact', id: 'fact_key_location' },
        before: 'The observatory key is in the lantern.',
        after: 'The observatory key is with Mira.',
        affected: {
          canonFacts: ['fact_key_location'],
          manuscriptChapters: ['chapter_2'],
          timelineEvents: ['timeline_1'],
          promises: ['promise_1'],
          secrets: ['secret_1'],
          worldRules: ['rule_1']
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      proposal: {
        projectId: 'project_1',
        target: { type: 'CanonFact', id: 'fact_key_location' },
        impactReport: {
          changedObject: { type: 'CanonFact', id: 'fact_key_location' },
          affected: {
            canonFacts: ['fact_key_location'],
            manuscriptChapters: ['chapter_2'],
            timelineEvents: ['timeline_1'],
            promises: ['promise_1'],
            secrets: ['secret_1'],
            worldRules: ['rule_1']
          }
        },
        diff: {
          before: 'The observatory key is in the lantern.',
          after: 'The observatory key is with Mira.'
        },
        approvalRisk: 'High'
      },
      regression: {
        status: 'Blocked',
        failures: [
          { scope: 'canon', status: 'Failed', evidence: ['Regression check for canon is Pending'] },
          { scope: 'manuscript', status: 'Failed', evidence: ['Regression check for manuscript is Pending'] },
          { scope: 'timeline', status: 'Failed', evidence: ['Regression check for timeline is Pending'] },
          { scope: 'promise', status: 'Failed', evidence: ['Regression check for promise is Pending'] },
          { scope: 'secret', status: 'Failed', evidence: ['Regression check for secret is Pending'] },
          { scope: 'world_rule', status: 'Failed', evidence: ['Regression check for world_rule is Pending'] }
        ]
      }
    });
    expect(response.json().proposal.id).toMatch(/^retcon_/);
    expect(response.json().proposal.approval.id).toMatch(/^approval_request_/);

    await app.close();
  });

  it('runs supplied retcon regression checks', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/branch-retcon/retcons/regression-checks/run',
      payload: {
        checks: [
          { scope: 'canon', status: 'Passed', evidence: ['canon verified'] },
          { scope: 'manuscript', status: 'Passed', evidence: ['manuscript verified'] },
          { scope: 'timeline', status: 'Passed', evidence: ['timeline verified'] },
          { scope: 'promise', status: 'Passed', evidence: ['promise verified'] },
          { scope: 'secret', status: 'Passed', evidence: ['secret verified'] },
          { scope: 'world_rule', status: 'Passed', evidence: ['world rule verified'] }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'Passed',
      checks: [
        { scope: 'canon', status: 'Passed', evidence: ['canon verified'] },
        { scope: 'manuscript', status: 'Passed', evidence: ['manuscript verified'] },
        { scope: 'timeline', status: 'Passed', evidence: ['timeline verified'] },
        { scope: 'promise', status: 'Passed', evidence: ['promise verified'] },
        { scope: 'secret', status: 'Passed', evidence: ['secret verified'] },
        { scope: 'world_rule', status: 'Passed', evidence: ['world rule verified'] }
      ],
      failures: []
    });

    await app.close();
  });

  it('rejects invalid branch and retcon payloads', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/branch-retcon/retcons/propose',
      payload: { projectId: '' }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid branch-retcon payload' });

    await app.close();
  });

  it('lists persisted branch scenarios, retcon proposals, and regression runs', async () => {
    const store: BranchRetconRouteStore = {
      saveBranchScenario: async () => undefined,
      saveRetconProposal: async () => undefined,
      saveRegressionCheckRun: async () => undefined,
      listBranchScenarios: async (projectId) => [
        {
          id: 'branch_scenario_1',
          projectId,
          name: 'Mira keeps the key',
          baseRef: { type: 'CanonFact', id: 'fact_1' },
          hypothesis: 'Mira keeps the key',
          status: 'Open',
          payload: { scenario: { id: 'branch_scenario_1' } },
          createdAt: '2026-04-27T12:00:00.000Z',
          updatedAt: '2026-04-27T12:00:00.000Z'
        }
      ],
      listRetconProposalsByTarget: async (projectId, targetType, targetId) => [
        {
          id: 'retcon_1',
          projectId: projectId as `project_${string}`,
          target: { type: targetType, id: targetId },
          impactReport: {
            changedObject: { type: targetType, id: targetId },
            affected: {
              canonFacts: [targetId],
              manuscriptChapters: [],
              timelineEvents: [],
              promises: [],
              secrets: [],
              worldRules: []
            }
          },
          diff: { before: 'Before', after: 'After' },
          regressionChecks: [],
          approvalRisk: 'High',
          approval: {
            id: 'approval_request_1' as `approval_request_${string}`,
            projectId: projectId as `project_${string}`,
            targetType,
            targetId,
            riskLevel: 'High',
            reason: 'Retcon requires approval.',
            proposedAction: 'Review retcon impact and regression checks',
            status: 'Pending',
            createdAt: '2026-04-27T12:00:00.000Z'
          },
          status: 'Proposed',
          createdAt: '2026-04-27T12:00:00.000Z',
          updatedAt: '2026-04-27T12:00:00.000Z'
        }
      ],
      listRegressionCheckRuns: async (proposalId) => [
        {
          id: 'regression_run_1',
          projectId: 'project_1',
          proposalId,
          status: 'Passed',
          checks: [{ scope: 'canon', status: 'Passed', evidence: ['canon verified'] }],
          createdAt: '2026-04-27T12:00:00.000Z'
        }
      ]
    };
    configurePersistentBranchRetconRouteStore(store);
    const app = buildApp();

    const scenariosResponse = await app.inject({
      method: 'GET',
      url: '/branch-retcon/projects/project_1/branches/scenarios'
    });
    const proposalsResponse = await app.inject({
      method: 'GET',
      url: '/branch-retcon/projects/project_1/targets/CanonFact/fact_key_location/retcon-proposals'
    });
    const runsResponse = await app.inject({
      method: 'GET',
      url: '/branch-retcon/projects/project_1/retcon-proposals/retcon_1/regression-check-runs'
    });

    expect(scenariosResponse.statusCode).toBe(200);
    expect(scenariosResponse.json()).toMatchObject([
      {
        id: 'branch_scenario_1',
        projectId: 'project_1',
        name: 'Mira keeps the key',
        status: 'Open'
      }
    ]);
    expect(proposalsResponse.statusCode).toBe(200);
    expect(proposalsResponse.json()).toMatchObject([
      {
        id: 'retcon_1',
        projectId: 'project_1',
        target: { type: 'CanonFact', id: 'fact_key_location' },
        status: 'Proposed'
      }
    ]);
    expect(runsResponse.statusCode).toBe(200);
    expect(runsResponse.json()).toEqual([
      {
        id: 'regression_run_1',
        projectId: 'project_1',
        proposalId: 'retcon_1',
        status: 'Passed',
        checks: [{ scope: 'canon', status: 'Passed', evidence: ['canon verified'] }],
        createdAt: '2026-04-27T12:00:00.000Z'
      }
    ]);

    await app.close();
  });

  it('persists branch scenarios, retcon proposals, and regression runs in the persistent runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Branch Retcon Night',
        language: 'en-US',
        targetAudience: 'serial fiction readers'
      }
    });
    const projectId = projectResponse.json().id;

    const branchResponse = await runtime.app.inject({
      method: 'POST',
      url: '/branch-retcon/branches/project',
      payload: {
        canon: { canonFactIds: ['fact_1'], artifactIds: ['chapter_1'] },
        scenario: {
          projectId,
          title: 'Mira keeps the key',
          baseCanonFactIds: ['fact_1'],
          artifacts: [{ id: 'branch_chapter_2', kind: 'chapter', content: 'Mira keeps the observatory key.' }]
        }
      }
    });

    expect(branchResponse.statusCode).toBe(200);
    await expect(runtime.stores.branchRetcon.listBranchScenarios(projectId)).resolves.toMatchObject([
      {
        projectId,
        name: 'Mira keeps the key',
        status: 'Open'
      }
    ]);

    const proposalResponse = await runtime.app.inject({
      method: 'POST',
      url: '/branch-retcon/retcons/propose',
      payload: {
        projectId,
        target: { type: 'CanonFact', id: 'fact_key_location' },
        before: 'The observatory key is in the lantern.',
        after: 'The observatory key is with Mira.',
        affected: {
          canonFacts: ['fact_key_location'],
          manuscriptChapters: ['chapter_2'],
          timelineEvents: ['timeline_1'],
          promises: ['promise_1'],
          secrets: ['secret_1'],
          worldRules: ['rule_1']
        }
      }
    });

    expect(proposalResponse.statusCode).toBe(200);
    const proposal = proposalResponse.json().proposal;
    await expect(
      runtime.stores.branchRetcon.listRetconProposalsByTarget(projectId, 'CanonFact', 'fact_key_location')
    ).resolves.toMatchObject([
      {
        id: proposal.id,
        projectId,
        status: 'Proposed',
        target: { type: 'CanonFact', id: 'fact_key_location' }
      }
    ]);

    const regressionResponse = await runtime.app.inject({
      method: 'POST',
      url: '/branch-retcon/retcons/regression-checks/run',
      payload: {
        projectId,
        proposalId: proposal.id,
        checks: [
          { scope: 'canon', status: 'Passed', evidence: ['canon verified'] },
          { scope: 'manuscript', status: 'Passed', evidence: ['manuscript verified'] },
          { scope: 'timeline', status: 'Passed', evidence: ['timeline verified'] },
          { scope: 'promise', status: 'Passed', evidence: ['promise verified'] },
          { scope: 'secret', status: 'Passed', evidence: ['secret verified'] },
          { scope: 'world_rule', status: 'Passed', evidence: ['world rule verified'] }
        ]
      }
    });

    expect(regressionResponse.statusCode).toBe(200);
    await expect(runtime.stores.branchRetcon.listRegressionCheckRuns(proposal.id)).resolves.toMatchObject([
      {
        projectId,
        proposalId: proposal.id,
        status: 'Passed'
      }
    ]);
    const scenariosResponse = await runtime.app.inject({
      method: 'GET',
      url: `/branch-retcon/projects/${projectId}/branches/scenarios`
    });
    const proposalsResponse = await runtime.app.inject({
      method: 'GET',
      url: `/branch-retcon/projects/${projectId}/targets/CanonFact/fact_key_location/retcon-proposals`
    });
    const runsResponse = await runtime.app.inject({
      method: 'GET',
      url: `/branch-retcon/projects/${projectId}/retcon-proposals/${proposal.id}/regression-check-runs`
    });

    expect(scenariosResponse.statusCode).toBe(200);
    expect(scenariosResponse.json()).toMatchObject([
      {
        projectId,
        name: 'Mira keeps the key',
        status: 'Open'
      }
    ]);
    expect(proposalsResponse.statusCode).toBe(200);
    expect(proposalsResponse.json()).toMatchObject([
      {
        id: proposal.id,
        projectId,
        status: 'Proposed',
        target: { type: 'CanonFact', id: 'fact_key_location' }
      }
    ]);
    expect(runsResponse.statusCode).toBe(200);
    expect(runsResponse.json()).toMatchObject([
      {
        projectId,
        proposalId: proposal.id,
        status: 'Passed'
      }
    ]);

    await runtime.app.close();
    runtime.database.client.close();
  });
});
