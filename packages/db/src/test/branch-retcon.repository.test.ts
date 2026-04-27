import { createProject, createRetconProposal } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { BranchRetconRepository, type BranchScenario, type RegressionCheckRun } from '../repositories/branch-retcon.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('BranchRetconRepository', () => {
  it('persists branch scenarios and retcon proposals by project target', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new BranchRetconRepository(database.db);
    const scenario: BranchScenario = {
      id: 'branch_scenario_1',
      projectId: project.id,
      name: 'Reveal the heir earlier',
      baseRef: { type: 'chapter', id: 'chapter_7' },
      hypothesis: 'Earlier reveal improves payoff but risks secret timing.',
      status: 'Open',
      payload: { branchPoint: 'chapter_7', notes: ['Keep local-first comparison material'] },
      createdAt: '2026-04-27T16:00:00.000Z',
      updatedAt: '2026-04-27T16:00:00.000Z'
    };
    const proposal = createRetconProposal({
      projectId: project.id,
      target: { type: 'secret', id: 'secret_heir' },
      before: 'The heir is revealed in chapter 12.',
      after: 'The heir is revealed in chapter 7.',
      affected: {
        canonFacts: ['canon_1'],
        manuscriptChapters: ['chapter_7', 'chapter_12'],
        timelineEvents: ['timeline_3'],
        promises: ['promise_1'],
        secrets: ['secret_heir'],
        worldRules: []
      }
    });

    await repository.saveBranchScenario(scenario);
    await repository.saveRetconProposal({
      ...proposal,
      id: 'retcon_proposal_1',
      scenarioId: scenario.id,
      status: 'Proposed',
      createdAt: '2026-04-27T16:05:00.000Z',
      updatedAt: '2026-04-27T16:05:00.000Z'
    });

    await expect(repository.listBranchScenarios(project.id)).resolves.toEqual([scenario]);
    await expect(repository.listRetconProposalsByTarget(project.id, 'secret', 'secret_heir')).resolves.toMatchObject([
      {
        id: 'retcon_proposal_1',
        scenarioId: 'branch_scenario_1',
        projectId: project.id,
        target: { type: 'secret', id: 'secret_heir' },
        diff: {
          before: 'The heir is revealed in chapter 12.',
          after: 'The heir is revealed in chapter 7.'
        },
        status: 'Proposed'
      }
    ]);
    database.client.close();
  });

  it('persists regression check runs and adoption status for retcon proposals', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new BranchRetconRepository(database.db);
    await repository.saveBranchScenario({
      id: 'branch_scenario_1',
      projectId: project.id,
      name: 'Reveal the heir earlier',
      baseRef: { type: 'chapter', id: 'chapter_7' },
      hypothesis: 'Earlier reveal improves payoff but risks secret timing.',
      status: 'Open',
      payload: {},
      createdAt: '2026-04-27T16:00:00.000Z',
      updatedAt: '2026-04-27T16:00:00.000Z'
    });
    const proposal = {
      ...createRetconProposal({
        projectId: project.id,
        target: { type: 'secret', id: 'secret_heir' },
        before: 'Late reveal.',
        after: 'Early reveal.',
        affected: {
          canonFacts: [],
          manuscriptChapters: ['chapter_7'],
          timelineEvents: [],
          promises: [],
          secrets: ['secret_heir'],
          worldRules: []
        }
      }),
      id: 'retcon_proposal_1',
      scenarioId: 'branch_scenario_1',
      status: 'Proposed' as const,
      createdAt: '2026-04-27T16:05:00.000Z',
      updatedAt: '2026-04-27T16:05:00.000Z'
    };
    const run: RegressionCheckRun = {
      id: 'regression_run_1',
      projectId: project.id,
      proposalId: proposal.id,
      status: 'Failed',
      checks: [
        {
          id: 'promise_check',
          status: 'Failed',
          message: 'Promise setup now resolves before it is introduced.'
        }
      ],
      createdAt: '2026-04-27T16:10:00.000Z'
    };

    await repository.saveRetconProposal(proposal);
    await repository.saveRegressionCheckRun(run);
    await repository.updateRetconProposalStatus(proposal.id, 'Adopted', '2026-04-27T16:20:00.000Z');

    await expect(repository.listRegressionCheckRuns(proposal.id)).resolves.toEqual([run]);
    await expect(repository.getRetconProposal(proposal.id)).resolves.toMatchObject({
      id: proposal.id,
      status: 'Adopted',
      updatedAt: '2026-04-27T16:20:00.000Z'
    });
    database.client.close();
  });
});
