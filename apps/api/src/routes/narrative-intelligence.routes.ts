import {
  assessReaderPromiseHealth,
  createClosureChecklist,
  getReaderPromiseUiState,
  recommendReaderPromisePayoff,
  type ReaderPromise
} from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface NarrativeStateReader {
  listByProjectAndType(projectId: string, type: 'promise' | 'arc'): Promise<Array<{ payload: unknown }>>;
}

export interface NarrativeIntelligenceRouteDependencies {
  narrativeStates?: NarrativeStateReader;
}

const narrativeEntityRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1)
});

const readerPromiseEvidenceSchema = z.object({
  chapterId: z.string().min(1),
  chapterNumber: z.number().int().positive(),
  excerpt: z.string().min(1),
  signal: z.enum(['Foreshadowing', 'Question', 'Expectation', 'Payoff', 'Complication']).optional()
});

const readerPromiseSchema: z.ZodType<ReaderPromise> = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1),
  level: z.enum(['Micro', 'Chapter', 'Volume', 'MainPlot', 'Endgame']),
  strength: z.enum(['Minor', 'Major', 'Core', 'Low', 'Medium', 'High']),
  surfaceClue: z.string().min(1),
  hiddenQuestion: z.string().min(1),
  readerExpectation: z.string().min(1),
  firstAppearance: z.object({
    chapterId: z.string().min(1),
    chapterNumber: z.number().int().positive()
  }),
  relatedEntities: z.array(narrativeEntityRefSchema),
  evidence: z.array(readerPromiseEvidenceSchema),
  payoffWindow: z.object({
    startChapter: z.number().int().positive(),
    endChapter: z.number().int().positive()
  }),
  sourceRunId: z.string().min(1),
  detectionConfidence: z.number().min(0).max(1),
  status: z.enum(['Candidate', 'Active', 'PayingOff', 'Fulfilled', 'Abandoned', 'PaidOff', 'Conflict', 'Dropped', 'Delayed']),
  health: z.enum(['Normal', 'ReadyForPayoff'])
});

const readerPromiseInspectSchema = z.object({
  promise: readerPromiseSchema,
  currentChapter: z.number().int().positive(),
  relatedEntitiesInScene: z.array(narrativeEntityRefSchema),
  evidence: z.array(readerPromiseEvidenceSchema).optional()
});

const closureChecklistSchema = z.object({
  projectId: z.string().min(1),
  promises: z.array(
    z.object({
      id: z.string().min(1),
      importance: z.string().min(1),
      status: z.string().min(1),
      summary: z.string().min(1),
      payoffWindow: z
        .object({
          startChapter: z.number().int().positive(),
          endChapter: z.number().int().positive()
        })
        .optional(),
      currentChapter: z.number().int().positive().optional()
    })
  ),
  characterArcs: z.array(
    z.object({
      id: z.string().min(1),
      characterId: z.string().min(1),
      importance: z.string().min(1),
      status: z.string().min(1),
      summary: z.string().min(1),
      currentChapter: z.number().int().positive().optional(),
      targetChapter: z.number().int().positive().optional()
    })
  )
});

const arcStatePayloadSchema = z.object({
  id: z.string().min(1),
  characterId: z.string().min(1),
  importance: z.string().min(1).default('Major'),
  status: z.string().min(1).default('Open'),
  summary: z.string().min(1),
  currentChapter: z.number().int().positive().optional(),
  targetChapter: z.number().int().positive().optional()
});

const summaryParamsSchema = z.object({
  projectId: z.string().min(1)
});

const summaryQuerySchema = z.object({
  currentChapter: z.coerce.number().int().positive().default(1)
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid narrative intelligence payload' });
}

export function registerNarrativeIntelligenceRoutes(
  app: FastifyInstance,
  dependencies: NarrativeIntelligenceRouteDependencies = {}
) {
  app.get<{ Params: { projectId: string }; Querystring: { currentChapter?: string } }>(
    '/narrative-intelligence/projects/:projectId/summary',
    async (request, reply) => {
      const params = summaryParamsSchema.safeParse(request.params);
      const query = summaryQuerySchema.safeParse(request.query);
      if (!params.success || !query.success) return invalidPayload(reply);

      if (!dependencies.narrativeStates) {
        return reply.send(emptySummary(params.data.projectId, query.data.currentChapter));
      }

      const [promiseRecords, arcRecords] = await Promise.all([
        dependencies.narrativeStates.listByProjectAndType(params.data.projectId, 'promise'),
        dependencies.narrativeStates.listByProjectAndType(params.data.projectId, 'arc')
      ]);
      const promises = promiseRecords
        .map((record) => readerPromiseSchema.safeParse(record.payload))
        .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
      const arcs = arcRecords
        .map((record) => arcStatePayloadSchema.safeParse(record.payload))
        .flatMap((parsed) => (parsed.success ? [parsed.data] : []));

      const promiseStates = promises.map((promise) => {
        const assessment = assessReaderPromiseHealth(promise, {
          currentChapter: query.data.currentChapter,
          relatedEntitiesInScene: promise.relatedEntities
        });
        const assessedPromise = { ...promise, health: assessment.health };

        return {
          id: promise.id,
          title: promise.title,
          health: assessment.health,
          uiState: getReaderPromiseUiState(assessedPromise),
          recommendation: recommendReaderPromisePayoff(assessedPromise, {
            currentChapter: query.data.currentChapter,
            relatedEntitiesInScene: promise.relatedEntities,
            evidence: promise.evidence
          })
        };
      });

      const checklist = createClosureChecklist({
        projectId: params.data.projectId,
        promises: promises.map((promise) => ({
          id: promise.id,
          importance: promise.strength === 'Core' ? 'Core' : 'Side',
          status: isResolvedPromiseStatus(promise.status) ? 'Resolved' : promise.status,
          summary: promise.title,
          payoffWindow: promise.payoffWindow,
          currentChapter: query.data.currentChapter
        })),
        characterArcs: arcs.map((arc) => ({
          ...arc,
          currentChapter: arc.currentChapter ?? query.data.currentChapter
        }))
      });

      return reply.send({
        projectId: params.data.projectId,
        currentChapter: query.data.currentChapter,
        promiseStates,
        closure: toClosureSummary(params.data.projectId, checklist)
      });
    }
  );

  app.post('/narrative-intelligence/reader-promises/inspect', async (request, reply) => {
    const parsed = readerPromiseInspectSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const health = assessReaderPromiseHealth(parsed.data.promise, parsed.data);
    const promise = { ...parsed.data.promise, health: health.health };

    return reply.send({
      promise,
      health: health.health,
      uiState: getReaderPromiseUiState(promise),
      recommendation: recommendReaderPromisePayoff(promise, parsed.data)
    });
  });

  app.post('/narrative-intelligence/closure-checklist/inspect', async (request, reply) => {
    const parsed = closureChecklistSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.send(createClosureChecklist(parsed.data));
  });
}

function emptySummary(projectId: string, currentChapter: number) {
  return {
    projectId,
    currentChapter,
    promiseStates: [],
    closure: {
      projectId,
      readyCount: 0,
      blockerCount: 0,
      blockers: []
    }
  };
}

function toClosureSummary(projectId: string, checklist: ReturnType<typeof createClosureChecklist>) {
  return {
    projectId,
    readyCount: 0,
    blockerCount: checklist.items.length,
    blockers: checklist.items.map((item) => ({
      id: item.sourceId,
      type: item.sourceType,
      label: item.label,
      reason: item.risk
    }))
  };
}

function isResolvedPromiseStatus(status: ReaderPromise['status']) {
  return status === 'PaidOff' || status === 'Fulfilled';
}
