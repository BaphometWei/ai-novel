import { describe, expect, it } from 'vitest';
import { createReviewFinding, markReviewFindingResolved } from '@ai-novel/domain';
import { recheckRevisionReview } from './revision-recheck';

const continuityFinding = (manuscriptVersionId: string, sourceId: string, problem = 'Lantern continuity mismatch.') =>
  createReviewFinding({
    manuscriptVersionId,
    category: 'continuity',
    severity: 'High',
    problem,
    evidenceCitations: [{ sourceId, quote: 'The lantern appears after it shattered.' }],
    impact: 'Breaks scene continuity.',
    fixOptions: ['Restore the lantern before reuse.'],
    autoFixRisk: 'Medium'
  });

describe('revision recheck workflow helper', () => {
  it('detects resolved findings that recur in a later review pass', () => {
    const original = continuityFinding('chapter_1_v1', 'chapter_1');
    const resolved = markReviewFindingResolved(original, {
      manuscriptVersionId: 'chapter_1_v2',
      resolvedBy: 'editor',
      resolution: 'Added replacement lantern.',
      resolvedAt: '2026-04-27T10:00:00.000Z'
    }).finding;
    const recurring = continuityFinding('chapter_1_v3', 'chapter_1');
    const repeatedElsewhere = continuityFinding('chapter_2_v1', 'chapter_2');

    const result = recheckRevisionReview({
      previousFindings: [resolved],
      currentFindings: [recurring, repeatedElsewhere],
      checkedAt: '2026-04-27T11:00:00.000Z'
    });

    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]?.finding.status).toBe('Regression');
    expect(result.regressions[0]?.event.detectedByFindingId).toBe(recurring.id);
    expect(result.recurringIssues).toEqual([
      expect.objectContaining({
        occurrenceCount: 2,
        trend: 'Recurring',
        risk: 'High'
      })
    ]);
  });
});
