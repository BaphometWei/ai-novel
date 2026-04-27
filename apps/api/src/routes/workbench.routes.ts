import {
  buildGenerationSourceContext,
  buildReviewReport,
  createKnowledgeItem,
  createReviewFinding,
  createRevisionSuggestion,
  createSourcePolicy,
  summarizeReaderFeedback,
  type GenerationSourceContext,
  type KnowledgeItem,
  type Project,
  type ReaderFeedback,
  type ReviewReport,
  type RevisionSuggestion
} from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface WorkbenchProjectLookup {
  findById(id: string): Project | null | Promise<Project | null>;
}

export interface WorkbenchReviewStore {
  saveReport(report: ReviewReport): Promise<void>;
  findReportById(id: string): Promise<ReviewReport | null>;
  findReportContainingFinding(projectId: string, findingId: string): Promise<ReviewReport | null>;
  saveRevisionSuggestion(suggestion: RevisionSuggestion): Promise<void>;
  findRevisionSuggestionById(id: string): Promise<RevisionSuggestion | null>;
}

export interface WorkbenchKnowledgeStore {
  saveKnowledgeItem(projectId: string, item: KnowledgeItem): Promise<void>;
  buildGenerationSourceContext(projectId: string): Promise<GenerationSourceContext>;
}

export interface WorkbenchSerializationStore {
  saveReaderFeedback(projectId: string, feedback: ReaderFeedback): Promise<void>;
  listReaderFeedback(projectId: string): Promise<ReaderFeedback[]>;
}

export interface WorkbenchRouteStores {
  projects: WorkbenchProjectLookup;
  review: WorkbenchReviewStore;
  knowledge: WorkbenchKnowledgeStore;
  serialization: WorkbenchSerializationStore;
}

const reviewSeveritySchema = z.enum(['Low', 'Medium', 'High', 'Blocking']);
const riskSchema = z.enum(['Low', 'Medium', 'High']);

const evidenceCitationSchema = z.object({
  sourceId: z.string().min(1),
  quote: z.string().min(1)
});

const createReviewFindingSchema = z.object({
  manuscriptVersionId: z.string().min(1),
  category: z.string().min(1),
  severity: reviewSeveritySchema,
  problem: z.string().min(1),
  evidenceCitations: z.array(evidenceCitationSchema),
  impact: z.string().min(1),
  fixOptions: z.array(z.string().min(1)),
  autoFixRisk: riskSchema
});

const createReviewReportSchema = z.object({
  manuscriptVersionId: z.string().min(1),
  profile: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    enabledCategories: z.array(z.string().min(1))
  }),
  findings: z.array(createReviewFindingSchema),
  qualityScore: z.object({
    overall: z.number(),
    continuity: z.number(),
    promiseSatisfaction: z.number(),
    prose: z.number()
  })
});

const createRevisionSuggestionSchema = z.object({
  findingId: z.string().min(1),
  manuscriptVersionId: z.string().min(1),
  title: z.string().min(1),
  rationale: z.string().min(1),
  diff: z.object({
    before: z.string(),
    after: z.string()
  }),
  risk: riskSchema
});

const readerFeedbackSchema = z.object({
  id: z.string().min(1),
  chapterId: z.string().min(1),
  segment: z.enum(['new_reader', 'core_reader', 'returning_reader', 'drive_by']),
  sentiment: z.enum(['Positive', 'Neutral', 'Negative']),
  tags: z.array(z.string().min(1)),
  text: z.string()
});

const feedbackSummarySchema = z.object({
  longTermPlanId: z.string().min(1),
  feedback: z.array(readerFeedbackSchema)
});

const sourceUseSchema = z.enum(['analysis', 'structure', 'style_parameters', 'generation_support']);

const sourcePolicyInputSchema = z.object({
  sourceType: z.enum(['original', 'user_note', 'licensed', 'public_domain', 'web_excerpt', 'agent_summary']),
  allowedUse: z.array(sourceUseSchema),
  prohibitedUse: z.array(sourceUseSchema),
  attributionRequirements: z.string(),
  licenseNotes: z.string(),
  similarityRisk: riskSchema
});

const knowledgeItemInputSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  kind: z.enum([
    'IdeaItem',
    'QuickCapture',
    'Material',
    'Sample',
    'Trope',
    'Technique',
    'GenreRule',
    'ScenePattern',
    'CharacterTemplate',
    'WorldTemplate',
    'StyleProfile',
    'ReviewRule',
    'AntiPattern',
    'StyleExperiment'
  ]),
  lifecycleStatus: z.enum(['Candidate', 'Active', 'Archived']),
  material: z.object({
    sourceTitle: z.string().min(1),
    sourcePolicy: sourcePolicyInputSchema,
    extractedSummary: z.string()
  }),
  tags: z.array(z.string().min(1))
});

const generationContextSchema = z.object({
  items: z.array(knowledgeItemInputSchema)
});

const projectParamsSchema = z.object({
  projectId: z.custom<`project_${string}`>(
    (value) => typeof value === 'string' && value.startsWith('project_'),
    'projectId must start with project_'
  )
});

const projectReportParamsSchema = projectParamsSchema.extend({
  id: z.string().min(1)
});

const projectSuggestionParamsSchema = projectParamsSchema.extend({
  id: z.string().min(1)
});

const feedbackImportSchema = z.object({
  longTermPlanId: z.string().min(1),
  feedback: z.array(readerFeedbackSchema)
});

const feedbackSummaryQuerySchema = z.object({
  longTermPlanId: z.string().min(1)
});

class InMemoryReviewStore implements WorkbenchReviewStore {
  private readonly reports = new Map<string, ReviewReport>();
  private readonly revisionSuggestions = new Map<string, RevisionSuggestion>();

  async saveReport(report: ReviewReport): Promise<void> {
    this.reports.set(report.id, report);
  }

  async findReportById(id: string): Promise<ReviewReport | null> {
    return this.reports.get(id) ?? null;
  }

  async findReportContainingFinding(projectId: string, findingId: string): Promise<ReviewReport | null> {
    return (
      [...this.reports.values()].find(
        (report) => report.projectId === projectId && report.findings.some((finding) => finding.id === findingId)
      ) ?? null
    );
  }

  async saveRevisionSuggestion(suggestion: RevisionSuggestion): Promise<void> {
    const findingExists = [...this.reports.values()].some((report) =>
      report.findings.some((finding) => finding.id === suggestion.findingId)
    );
    if (!findingExists) throw new Error(`Review finding not found: ${suggestion.findingId}`);
    this.revisionSuggestions.set(suggestion.id, suggestion);
  }

  async findRevisionSuggestionById(id: string): Promise<RevisionSuggestion | null> {
    return this.revisionSuggestions.get(id) ?? null;
  }
}

class InMemoryKnowledgeStore implements WorkbenchKnowledgeStore {
  private readonly itemsByProject = new Map<string, KnowledgeItem[]>();

  async saveKnowledgeItem(projectId: string, item: KnowledgeItem): Promise<void> {
    this.itemsByProject.set(projectId, [...(this.itemsByProject.get(projectId) ?? []), item]);
  }

  async buildGenerationSourceContext(projectId: string): Promise<GenerationSourceContext> {
    return buildGenerationSourceContext(this.itemsByProject.get(projectId) ?? []);
  }
}

class InMemorySerializationStore implements WorkbenchSerializationStore {
  private readonly feedbackByProject = new Map<string, ReaderFeedback[]>();

  async saveReaderFeedback(projectId: string, feedback: ReaderFeedback): Promise<void> {
    const existing = this.feedbackByProject.get(projectId) ?? [];
    if (existing.some((saved) => saved.id === feedback.id)) return;
    this.feedbackByProject.set(projectId, [...existing, feedback]);
  }

  async listReaderFeedback(projectId: string): Promise<ReaderFeedback[]> {
    return this.feedbackByProject.get(projectId) ?? [];
  }
}

export function createInMemoryWorkbenchStores(projects: WorkbenchProjectLookup): WorkbenchRouteStores {
  return {
    projects,
    review: new InMemoryReviewStore(),
    knowledge: new InMemoryKnowledgeStore(),
    serialization: new InMemorySerializationStore()
  };
}

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid workbench payload' });
}

async function findProjectOr404(stores: WorkbenchRouteStores, projectId: string, reply: FastifyReply) {
  const project = await stores.projects.findById(projectId);
  if (!project) {
    reply.code(404).send({ error: 'Project not found' });
    return null;
  }
  return project;
}

function toKnowledgeItem(input: z.infer<typeof knowledgeItemInputSchema>): KnowledgeItem {
  const material = {
    ...input.material,
    sourcePolicy: createSourcePolicy(input.material.sourcePolicy)
  };

  return input.id
    ? {
        id: input.id,
        title: input.title,
        kind: input.kind,
        lifecycleStatus: input.lifecycleStatus,
        material,
        tags: input.tags,
        embeddings: []
      }
    : createKnowledgeItem({
        ...input,
        material
      });
}

export function registerWorkbenchRoutes(app: FastifyInstance, stores: WorkbenchRouteStores) {
  app.post('/review/findings', async (request, reply) => {
    const parsed = createReviewFindingSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.code(201).send(createReviewFinding(parsed.data));
  });

  app.post('/review/revision-suggestions', async (request, reply) => {
    const parsed = createRevisionSuggestionSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.code(201).send(createRevisionSuggestion(parsed.data));
  });

  app.post('/projects/:projectId/review/reports', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const parsed = createReviewReportSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    const findings = parsed.data.findings.map((finding) => createReviewFinding(finding));
    const report = buildReviewReport({
      projectId: params.data.projectId,
      manuscriptVersionId: parsed.data.manuscriptVersionId,
      profile: parsed.data.profile,
      findings,
      qualityScore: parsed.data.qualityScore
    });
    await stores.review.saveReport(report);
    return reply.code(201).send(report);
  });

  app.get('/projects/:projectId/review/reports/:id', async (request, reply) => {
    const params = projectReportParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    const report = await stores.review.findReportById(params.data.id);
    if (!report || report.projectId !== params.data.projectId) {
      return reply.code(404).send({ error: 'Review report not found' });
    }
    return reply.send(report);
  });

  app.post('/projects/:projectId/review/revision-suggestions', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const parsed = createRevisionSuggestionSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    const owningReport = await stores.review.findReportContainingFinding(params.data.projectId, parsed.data.findingId);
    if (!owningReport) return reply.code(404).send({ error: 'Review finding not found' });

    const suggestion = createRevisionSuggestion(parsed.data);
    await stores.review.saveRevisionSuggestion(suggestion);
    return reply.code(201).send(suggestion);
  });

  app.get('/projects/:projectId/review/revision-suggestions/:id', async (request, reply) => {
    const params = projectSuggestionParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    const suggestion = await stores.review.findRevisionSuggestionById(params.data.id);
    if (!suggestion) return reply.code(404).send({ error: 'Revision suggestion not found' });

    const owningReport = await stores.review.findReportContainingFinding(params.data.projectId, suggestion.findingId);
    if (!owningReport) return reply.code(404).send({ error: 'Revision suggestion not found' });
    return reply.send(suggestion);
  });

  app.post('/serialization/feedback-summary', async (request, reply) => {
    const parsed = feedbackSummarySchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.send(summarizeReaderFeedback(parsed.data));
  });

  app.post('/projects/:projectId/serialization/reader-feedback', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const parsed = feedbackImportSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    const uniqueFeedback = [...new Map(parsed.data.feedback.map((feedback) => [feedback.id, feedback])).values()];
    for (const feedback of uniqueFeedback) {
      await stores.serialization.saveReaderFeedback(params.data.projectId, feedback);
    }
    const saved = await stores.serialization.listReaderFeedback(params.data.projectId);
    return reply.send(summarizeReaderFeedback({ longTermPlanId: parsed.data.longTermPlanId, feedback: saved }));
  });

  app.get('/projects/:projectId/serialization/feedback-summary', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const query = feedbackSummaryQuerySchema.safeParse(request.query);
    if (!params.success || !query.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    const feedback = await stores.serialization.listReaderFeedback(params.data.projectId);
    return reply.send(summarizeReaderFeedback({ longTermPlanId: query.data.longTermPlanId, feedback }));
  });

  app.post('/knowledge/generation-context', async (request, reply) => {
    const parsed = generationContextSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const items = parsed.data.items.map(toKnowledgeItem);

    return reply.send(buildGenerationSourceContext(items));
  });

  app.post('/projects/:projectId/knowledge/items', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const parsed = knowledgeItemInputSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    const item = toKnowledgeItem(parsed.data);
    await stores.knowledge.saveKnowledgeItem(params.data.projectId, item);
    return reply.code(201).send(item);
  });

  app.get('/projects/:projectId/knowledge/generation-context', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);
    if (!(await findProjectOr404(stores, params.data.projectId, reply))) return reply;

    return reply.send(await stores.knowledge.buildGenerationSourceContext(params.data.projectId));
  });
}
