import { describe, expect, it } from 'vitest';
import { createReviewFinding } from './review';
import {
  buildRecurringIssueSummary,
  markReviewFindingAccepted,
  markReviewFindingFalsePositive,
  markReviewFindingRegression,
  markReviewFindingRejected,
  markReviewFindingResolved
} from './review-learning';

const baseFinding = (overrides: Partial<Parameters<typeof createReviewFinding>[0]> = {}) =>
  createReviewFinding({
    manuscriptVersionId: 'chapter_1_v1',
    category: 'continuity',
    severity: 'High',
    problem: 'The lantern is destroyed and then used again.',
    evidenceCitations: [{ sourceId: 'chapter_1', quote: 'The lantern shattered.' }],
    impact: 'Breaks scene continuity.',
    fixOptions: ['Restore the lantern before it is used again.'],
    autoFixRisk: 'Medium',
    ...overrides
  });

describe('review learning lifecycle', () => {
  it('records false-positive, accepted, rejected, resolved, and regression lifecycle states', () => {
    const finding = baseFinding();

    const falsePositive = markReviewFindingFalsePositive(finding, {
      decidedBy: 'author',
      reason: 'The lantern is intentionally symbolic.',
      decidedAt: '2026-04-27T09:00:00.000Z'
    });
    const accepted = markReviewFindingAccepted(finding, {
      decidedBy: 'editor',
      rationale: 'The continuity break is valid.',
      decidedAt: '2026-04-27T10:00:00.000Z'
    });
    const rejected = markReviewFindingRejected(finding, {
      decidedBy: 'author',
      reason: 'The evidence points at a dream sequence.',
      decidedAt: '2026-04-27T11:00:00.000Z'
    });
    const resolved = markReviewFindingResolved(finding, {
      manuscriptVersionId: 'chapter_1_v2',
      resolvedBy: 'editor',
      resolution: 'Added a replacement lantern before the later scene.',
      resolvedAt: '2026-04-27T12:00:00.000Z'
    });
    const regression = markReviewFindingRegression(resolved.finding, {
      manuscriptVersionId: 'chapter_1_v3',
      detectedByFindingId: 'review_finding_regression',
      regressedAt: '2026-04-27T13:00:00.000Z'
    });

    expect(falsePositive.finding.status).toBe('FalsePositive');
    expect(falsePositive.event.kind).toBe('FalsePositive');
    expect(accepted.finding.status).toBe('Accepted');
    expect(accepted.event.kind).toBe('Accepted');
    expect(rejected.finding.status).toBe('Rejected');
    expect(rejected.event.kind).toBe('Rejected');
    expect(resolved.finding.status).toBe('Resolved');
    expect(resolved.event.kind).toBe('Resolved');
    expect(regression.finding.status).toBe('Regression');
    expect(regression.event.previousStatus).toBe('Resolved');
  });

  it('summarizes repeated issue signatures across chapters as trend and risk', () => {
    const findings = [
      baseFinding({
        manuscriptVersionId: 'chapter_1_v1',
        problem: 'Lantern continuity mismatch.',
        evidenceCitations: [{ sourceId: 'chapter_1', quote: 'The lantern shattered.' }]
      }),
      baseFinding({
        manuscriptVersionId: 'chapter_2_v1',
        problem: 'Lantern continuity mismatch.',
        evidenceCitations: [{ sourceId: 'chapter_2', quote: 'The lantern lit the stair.' }]
      }),
      baseFinding({
        manuscriptVersionId: 'chapter_3_v1',
        problem: 'Lantern continuity mismatch.',
        evidenceCitations: [{ sourceId: 'chapter_3', quote: 'She raised the lantern again.' }]
      }),
      baseFinding({
        manuscriptVersionId: 'chapter_2_v1',
        category: 'voice',
        severity: 'Low',
        problem: 'Narrator voice drifts.',
        evidenceCitations: [{ sourceId: 'chapter_2', quote: 'The vibes were weird.' }],
        impact: 'Briefly weakens style.',
        autoFixRisk: 'Low'
      })
    ];

    const summary = buildRecurringIssueSummary(findings, { minimumOccurrences: 2 });

    expect(summary).toEqual([
      expect.objectContaining({
        category: 'continuity',
        occurrenceCount: 3,
        chapterIds: ['chapter_1', 'chapter_2', 'chapter_3'],
        trend: 'Escalating',
        risk: 'High'
      })
    ]);
  });
});
