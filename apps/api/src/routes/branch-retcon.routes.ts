import {
  adoptBranchScenario,
  createBranchScenario,
  createRetconProposal,
  projectBranchScenario,
  runNarrativeRegressionChecks,
  type BranchScenario,
  type EntityId,
  type NarrativeRegressionCheck
} from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface BranchRetconRouteStore {
  listBranchScenarios(projectId: string): Promise<
    {
      id: string;
      projectId: string;
      name: string;
      baseRef: { type: string; id: string };
      hypothesis: string;
      status: 'Open' | 'Closed' | 'Adopted' | 'Rejected';
      payload: unknown;
      createdAt: string;
      updatedAt: string;
    }[]
  >;
  listRetconProposalsByTarget(
    projectId: string,
    targetType: string,
    targetId: string
  ): Promise<
    (ReturnType<typeof createRetconProposal> & {
      scenarioId?: string;
      status: 'Proposed' | 'Approved' | 'Rejected' | 'Adopted';
      createdAt: string;
      updatedAt: string;
    })[]
  >;
  listRegressionCheckRuns(proposalId: string): Promise<
    {
      id: string;
      projectId: string;
      proposalId: string;
      status: 'Passed' | 'Failed' | 'Blocked';
      checks: unknown[];
      createdAt: string;
    }[]
  >;
  saveBranchScenario(scenario: {
    id: string;
    projectId: string;
    name: string;
    baseRef: { type: string; id: string };
    hypothesis: string;
    status: 'Open' | 'Closed' | 'Adopted' | 'Rejected';
    payload: unknown;
    createdAt: string;
    updatedAt: string;
  }): Promise<void>;
  saveRetconProposal(proposal: ReturnType<typeof createRetconProposal> & {
    status: 'Proposed' | 'Approved' | 'Rejected' | 'Adopted';
    createdAt: string;
    updatedAt: string;
  }): Promise<void>;
  saveRegressionCheckRun(run: {
    id: string;
    projectId: string;
    proposalId: string;
    status: 'Passed' | 'Failed' | 'Blocked';
    checks: unknown[];
    createdAt: string;
  }): Promise<void>;
}

let pendingPersistentStore: BranchRetconRouteStore | undefined;

export function configurePersistentBranchRetconRouteStore(store: BranchRetconRouteStore): void {
  pendingPersistentStore = store;
}

const canonSchema = z.object({
  canonFactIds: z.array(z.string().min(1)),
  artifactIds: z.array(z.string().min(1))
});

const branchArtifactSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  content: z.string().min(1)
});

const branchScenarioInputSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1),
  baseCanonFactIds: z.array(z.string().min(1)),
  artifacts: z.array(branchArtifactSchema)
});

const branchScenarioSchema = branchScenarioInputSchema.extend({
  id: z.string().min(1)
});

const branchProjectSchema = z.object({
  canon: canonSchema,
  scenario: branchScenarioInputSchema
});

const branchAdoptSchema = z.object({
  canon: canonSchema,
  scenario: branchScenarioSchema
});

const narrativeObjectRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1)
});

const affectedSchema = z.object({
  canonFacts: z.array(z.string().min(1)),
  manuscriptChapters: z.array(z.string().min(1)),
  timelineEvents: z.array(z.string().min(1)),
  promises: z.array(z.string().min(1)),
  secrets: z.array(z.string().min(1)),
  worldRules: z.array(z.string().min(1)),
  chapters: z.array(z.string().min(1)).optional(),
  arcs: z.array(z.string().min(1)).optional(),
  rules: z.array(z.string().min(1)).optional()
});

const retconProposalSchema = z.object({
  projectId: z.string().min(1),
  target: narrativeObjectRefSchema,
  before: z.string().min(1),
  after: z.string().min(1),
  affected: affectedSchema
});

const regressionCheckSchema = z.object({
  scope: z.enum(['canon', 'manuscript', 'timeline', 'promise', 'secret', 'world_rule']),
  status: z.enum(['Pending', 'Passed', 'Failed']),
  evidence: z.array(z.string().min(1))
});

const regressionRunSchema = z.object({
  projectId: z.string().min(1).optional(),
  proposalId: z.string().min(1).optional(),
  checks: z.array(regressionCheckSchema)
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid branch-retcon payload' });
}

export function registerBranchRetconRoutes(app: FastifyInstance) {
  const store = pendingPersistentStore;
  pendingPersistentStore = undefined;

  app.get<{ Params: { projectId: string } }>(
    '/branch-retcon/projects/:projectId/branches/scenarios',
    async (request) => {
      if (!store) return [];

      return store.listBranchScenarios(request.params.projectId);
    }
  );

  app.get<{
    Params: { projectId: string; targetType: string; targetId: string };
  }>('/branch-retcon/projects/:projectId/targets/:targetType/:targetId/retcon-proposals', async (request) => {
    if (!store) return [];

    return store.listRetconProposalsByTarget(
      request.params.projectId,
      request.params.targetType,
      request.params.targetId
    );
  });

  app.get<{
    Params: { proposalId: string };
  }>('/branch-retcon/projects/:projectId/retcon-proposals/:proposalId/regression-check-runs', async (request) => {
    if (!store) return [];

    return store.listRegressionCheckRuns(request.params.proposalId);
  });

  app.post('/branch-retcon/branches/project', async (request, reply) => {
    const parsed = branchProjectSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const scenario = createBranchScenario(parsed.data.scenario);
    const projection = projectBranchScenario(parsed.data.canon, scenario);
    if (store) {
      const now = new Date().toISOString();
      await store.saveBranchScenario({
        id: scenario.id,
        projectId: scenario.projectId,
        name: scenario.title,
        baseRef: { type: 'CanonFact', id: scenario.baseCanonFactIds[0] ?? 'none' },
        hypothesis: scenario.title,
        status: 'Open',
        payload: { scenario, projection },
        createdAt: now,
        updatedAt: now
      });
    }

    return reply.send({
      scenario,
      projection
    });
  });

  app.post('/branch-retcon/branches/adopt', async (request, reply) => {
    const parsed = branchAdoptSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.send({
      canon: adoptBranchScenario(parsed.data.canon, parsed.data.scenario as BranchScenario)
    });
  });

  app.post('/branch-retcon/retcons/propose', async (request, reply) => {
    const parsed = retconProposalSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const proposal = createRetconProposal({
      ...parsed.data,
      projectId: parsed.data.projectId as EntityId<'project'>
    });
    if (store) {
      const now = new Date().toISOString();
      await store.saveRetconProposal({
        ...proposal,
        status: 'Proposed',
        createdAt: now,
        updatedAt: now
      });
    }

    return reply.send({
      proposal,
      regression: runNarrativeRegressionChecks(proposal.regressionChecks)
    });
  });

  app.post('/branch-retcon/retcons/regression-checks/run', async (request, reply) => {
    const parsed = regressionRunSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const result = runNarrativeRegressionChecks(parsed.data.checks as NarrativeRegressionCheck[]);
    if (store && parsed.data.projectId && parsed.data.proposalId) {
      await store.saveRegressionCheckRun({
        id: `regression_run_${crypto.randomUUID().replace(/-/g, '')}`,
        projectId: parsed.data.projectId,
        proposalId: parsed.data.proposalId,
        status: result.status,
        checks: result.checks,
        createdAt: new Date().toISOString()
      });
    }

    return reply.send(result);
  });
}
