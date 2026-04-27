import { evaluateRetrievalRegression, type EvaluateRetrievalRegressionInput } from '@ai-novel/evaluation';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface RetrievalRouteDependencies {
  evaluate?(input: EvaluateRetrievalRegressionInput): ReturnType<typeof evaluateRetrievalRegression>;
  search?(input: RetrievalProjectSearchInput): Promise<RetrievalProjectSearchResult[]> | RetrievalProjectSearchResult[];
}

export type RetrievalProjectSearchType = 'manuscript' | 'canon' | 'knowledge' | 'runs' | 'review' | 'feedback';

export interface RetrievalProjectSearchInput {
  projectId: string;
  query: string;
  types?: RetrievalProjectSearchType[];
}

export interface RetrievalProjectSearchResult {
  id: string;
  title: string;
  snippet: string;
}

const retrievalItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).optional()
});

const retrievalExcludedItemSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1)
});

const retrievalRegressionSchema = z.object({
  caseId: z.string().min(1),
  projectId: z.string().min(1),
  query: z.string().min(1),
  policy: z.object({
    id: z.string().min(1),
    description: z.string().min(1).optional()
  }),
  mustInclude: z.array(retrievalItemSchema),
  forbidden: z.array(retrievalItemSchema),
  included: z.array(retrievalItemSchema),
  excluded: z.array(retrievalExcludedItemSchema)
});

const projectRetrievalRunSchema = retrievalRegressionSchema
  .omit({
    projectId: true,
    included: true,
    excluded: true
  })
  .extend({
    maxResults: z.number().int().positive().max(50).optional(),
    types: z.array(z.enum(['manuscript', 'canon', 'knowledge', 'runs', 'review', 'feedback'])).optional()
  });

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid retrieval regression payload' });
}

function serializeFailure(failure: ReturnType<typeof evaluateRetrievalRegression>['failures'][number]) {
  return {
    kind: failure.type,
    id: failure.itemId
  };
}

export function registerRetrievalRoutes(
  app: FastifyInstance,
  dependencies: RetrievalRouteDependencies = { evaluate: evaluateRetrievalRegression }
) {
  const evaluate = dependencies.evaluate ?? evaluateRetrievalRegression;

  app.post<{ Params: { projectId: string } }>('/retrieval/projects/:projectId/regression/run', async (request, reply) => {
    const parsed = projectRetrievalRunSchema.safeParse(request.body);
    if (!parsed.success || !request.params.projectId) return invalidPayload(reply);

    const maxResults = parsed.data.maxResults ?? 8;
    const searchResults = dependencies.search
      ? await dependencies.search({
          projectId: request.params.projectId,
          query: parsed.data.query,
          types: parsed.data.types
        })
      : [];
    const included = searchResults.slice(0, maxResults).map((result) => ({
      id: result.id,
      text: result.snippet || result.title
    }));
    const includedIds = new Set(included.map((item) => item.id));
    const requiredIds = new Map([...parsed.data.mustInclude, ...parsed.data.forbidden].map((item) => [item.id, item]));
    const excluded = [...requiredIds.values()]
      .filter((item) => !includedIds.has(item.id))
      .map((item) => ({
        id: item.id,
        reason: 'not_returned_by_project_search'
      }));

    return reply.send(
      serializeRetrievalResult(
        evaluate({
          ...parsed.data,
          projectId: request.params.projectId,
          included,
          excluded
        })
      )
    );
  });

  app.post('/retrieval/regression/evaluate', async (request, reply) => {
    const parsed = retrievalRegressionSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.send(serializeRetrievalResult(evaluate(parsed.data)));
  });
}

function serializeRetrievalResult(result: ReturnType<typeof evaluateRetrievalRegression>) {
  return {
    caseId: result.caseId,
    projectId: result.projectId,
    query: result.query,
    policyId: result.policyId,
    passed: result.passed,
    summary: {
      includedCount: result.snapshot.included.length,
      excludedCount: result.snapshot.excluded.length,
      failureCount: result.failures.length
    },
    included: result.snapshot.included,
    excluded: result.snapshot.excluded,
    failures: result.failures.map(serializeFailure)
  };
}
