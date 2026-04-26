import {
  buildGenerationSourceContext,
  createKnowledgeItem,
  createReviewFinding,
  createRevisionSuggestion,
  createSourcePolicy,
  summarizeReaderFeedback
} from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

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

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid workbench payload' });
}

export function registerWorkbenchRoutes(app: FastifyInstance) {
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

  app.post('/serialization/feedback-summary', async (request, reply) => {
    const parsed = feedbackSummarySchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    return reply.send(summarizeReaderFeedback(parsed.data));
  });

  app.post('/knowledge/generation-context', async (request, reply) => {
    const parsed = generationContextSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const items = parsed.data.items.map((item) =>
      item.id
        ? {
            id: item.id,
            title: item.title,
            kind: item.kind,
            lifecycleStatus: item.lifecycleStatus,
            material: {
              ...item.material,
              sourcePolicy: createSourcePolicy(item.material.sourcePolicy)
            },
            tags: item.tags,
            embeddings: []
          }
        : createKnowledgeItem({
        ...item,
        material: {
          ...item.material,
          sourcePolicy: createSourcePolicy(item.material.sourcePolicy)
        }
      })
    );

    return reply.send(buildGenerationSourceContext(items));
  });
}
