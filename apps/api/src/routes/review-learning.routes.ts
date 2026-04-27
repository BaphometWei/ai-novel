import { buildRecurringIssueSummary, type RecurringIssueSummary, type ReviewFinding, type ReviewLearningEvent } from '@ai-novel/domain';
import { recheckRevisionReview, type RevisionRecheckResult } from '@ai-novel/workflow';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface ReviewLearningRouteDependencies {
  buildRecurringIssueSummary: typeof buildRecurringIssueSummary;
  recheckRevisionReview: typeof recheckRevisionReview;
  store?: ReviewLearningRouteStore;
}

export interface ReviewLearningRouteStore {
  saveLifecycleEvent(record: {
    projectId: string;
    profileId: string;
    category: string;
    event: ReviewLearningEvent;
    findingSnapshot: ReviewFinding;
  }): Promise<void>;
  upsertRecurringIssueSummary(record: {
    projectId: string;
    profileId: string;
    category: string;
    summary: RecurringIssueSummary;
    updatedAt: string;
  }): Promise<void>;
}

type RecheckStatus = 'Resolved' | 'Regressed' | 'StillOpen';

interface RecheckStatusSummary {
  findingId: string;
  status: RecheckStatus;
  currentFindingId?: string;
}

const reviewFindingSchema: z.ZodType<ReviewFinding> = z.object({
  id: z.string().min(1),
  manuscriptVersionId: z.string().min(1),
  category: z.string().min(1),
  severity: z.enum(['Low', 'Medium', 'High', 'Blocking']),
  problem: z.string().min(1),
  evidenceCitations: z.array(
    z.object({
      sourceId: z.string().min(1),
      quote: z.string().min(1)
    })
  ),
  impact: z.string().min(1),
  fixOptions: z.array(z.string().min(1)),
  autoFixRisk: z.enum(['Low', 'Medium', 'High']),
  status: z.enum(['Open', 'Accepted', 'Applied', 'Rejected', 'FalsePositive', 'Resolved', 'Regression'])
});

const recurringIssueSummarySchema = z.object({
  projectId: z.string().min(1).optional(),
  profileId: z.string().min(1).optional(),
  findings: z.array(reviewFindingSchema),
  minimumOccurrences: z.number().int().positive().optional()
});

const revisionRecheckSchema = z.object({
  projectId: z.string().min(1).optional(),
  profileId: z.string().min(1).optional(),
  previousManuscriptVersionId: z.string().min(1),
  currentManuscriptVersionId: z.string().min(1),
  previousFindings: z.array(reviewFindingSchema),
  currentFindings: z.array(reviewFindingSchema),
  checkedAt: z.string().min(1)
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid review learning payload' });
}

export function createDefaultReviewLearningDependencies(): ReviewLearningRouteDependencies {
  return {
    buildRecurringIssueSummary,
    recheckRevisionReview
  };
}

export function registerReviewLearningRoutes(
  app: FastifyInstance,
  dependencies: ReviewLearningRouteDependencies = createDefaultReviewLearningDependencies()
) {
  app.post('/review-learning/recurring-issues', async (request, reply) => {
    const parsed = recurringIssueSummarySchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);
    const recurringIssues = dependencies.buildRecurringIssueSummary(parsed.data.findings, {
      minimumOccurrences: parsed.data.minimumOccurrences
    });
    await persistRecurringIssueSummaries(dependencies.store, {
      projectId: parsed.data.projectId,
      profileId: parsed.data.profileId,
      recurringIssues,
      updatedAt: new Date().toISOString()
    });

    return reply.send({
      recurringIssues
    });
  });

  app.post('/review-learning/recheck', async (request, reply) => {
    const parsed = revisionRecheckSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const result = dependencies.recheckRevisionReview({
      previousFindings: parsed.data.previousFindings,
      currentFindings: parsed.data.currentFindings,
      checkedAt: parsed.data.checkedAt
    });
    await persistReviewLearningResult(dependencies.store, {
      projectId: parsed.data.projectId,
      profileId: parsed.data.profileId,
      transitions: result.regressions,
      recurringIssues: result.recurringIssues,
      updatedAt: parsed.data.checkedAt
    });

    return reply.send({
      previousManuscriptVersionId: parsed.data.previousManuscriptVersionId,
      currentManuscriptVersionId: parsed.data.currentManuscriptVersionId,
      statuses: summarizeRecheckStatuses(parsed.data.previousFindings, parsed.data.currentFindings, result),
      regressions: result.regressions,
      recurringIssues: result.recurringIssues
    });
  });
}

async function persistReviewLearningResult(
  store: ReviewLearningRouteStore | undefined,
  input: {
    projectId?: string;
    profileId?: string;
    transitions: RevisionRecheckResult['regressions'];
    recurringIssues: RecurringIssueSummary[];
    updatedAt: string;
  }
): Promise<void> {
  if (!store || !input.projectId || !input.profileId) return;

  for (const transition of input.transitions) {
    await store.saveLifecycleEvent({
      projectId: input.projectId,
      profileId: input.profileId,
      category: transition.finding.category,
      event: transition.event,
      findingSnapshot: transition.finding
    });
  }

  await persistRecurringIssueSummaries(store, input);
}

async function persistRecurringIssueSummaries(
  store: ReviewLearningRouteStore | undefined,
  input: {
    projectId?: string;
    profileId?: string;
    recurringIssues: RecurringIssueSummary[];
    updatedAt: string;
  }
): Promise<void> {
  if (!store || !input.projectId || !input.profileId) return;

  for (const summary of input.recurringIssues) {
    await store.upsertRecurringIssueSummary({
      projectId: input.projectId,
      profileId: input.profileId,
      category: summary.category,
      summary,
      updatedAt: input.updatedAt
    });
  }
}

function summarizeRecheckStatuses(
  previousFindings: ReviewFinding[],
  currentFindings: ReviewFinding[],
  result: RevisionRecheckResult
): RecheckStatusSummary[] {
  const regressedByFindingId = new Map(
    result.regressions.map((transition) => [transition.finding.id, transition.event.detectedByFindingId])
  );

  return previousFindings.map((finding) => {
    const regressedCurrentFindingId = regressedByFindingId.get(finding.id);
    if (regressedCurrentFindingId) {
      return { findingId: finding.id, status: 'Regressed', currentFindingId: regressedCurrentFindingId };
    }

    const currentFinding = findRecurringCurrentFinding(finding, currentFindings);
    if (currentFinding) {
      return { findingId: finding.id, status: 'StillOpen', currentFindingId: currentFinding.id };
    }

    return { findingId: finding.id, status: 'Resolved' };
  });
}

function findRecurringCurrentFinding(previousFinding: ReviewFinding, currentFindings: ReviewFinding[]): ReviewFinding | undefined {
  const previousSignature = buildRecheckSignature(previousFinding);
  const sameIssueFindings = currentFindings.filter((finding) => buildRecheckSignature(finding) === previousSignature);

  return sameIssueFindings.find((finding) => getFirstSourceId(finding) === getFirstSourceId(previousFinding)) ?? sameIssueFindings[0];
}

function buildRecheckSignature(finding: ReviewFinding): string {
  return `${finding.category}:${finding.problem.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
}

function getFirstSourceId(finding: ReviewFinding): string | undefined {
  return finding.evidenceCitations[0]?.sourceId;
}
