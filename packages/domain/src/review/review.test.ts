import { describe, expect, it } from 'vitest';
import {
  buildReviewReport,
  createFalsePositiveRecord,
  createReviewFinding,
  createRevisionSuggestion
} from './review';

describe('ReviewFinding', () => {
  it('targets a specific manuscript version with evidence and fix options', () => {
    const finding = createReviewFinding({
      manuscriptVersionId: 'artifact_version_1',
      category: 'continuity',
      severity: 'High',
      problem: 'Mei knows the secret before the reveal.',
      evidenceCitations: [{ sourceId: 'secret_1', quote: 'Mei has not learned this yet.' }],
      impact: 'Breaks knowledge boundary.',
      fixOptions: ['Move the line after reveal', 'Change speaker'],
      autoFixRisk: 'Medium'
    });

    expect(finding.status).toBe('Open');
    expect(finding.manuscriptVersionId).toBe('artifact_version_1');
    expect(finding.fixOptions).toHaveLength(2);
  });

  it('builds review reports with quality scores and open finding counts', () => {
    const finding = createReviewFinding({
      manuscriptVersionId: 'artifact_version_1',
      category: 'continuity',
      severity: 'High',
      problem: 'Promise payoff is contradicted.',
      evidenceCitations: [{ sourceId: 'promise_1', quote: 'The oath should still be active.' }],
      impact: 'Weakens reader trust.',
      fixOptions: ['Delay the payoff'],
      autoFixRisk: 'High'
    });

    const report = buildReviewReport({
      projectId: 'project_1',
      manuscriptVersionId: 'artifact_version_1',
      profile: { id: 'review_profile_standard', name: 'Standard', enabledCategories: ['continuity'] },
      findings: [finding],
      qualityScore: { overall: 76, continuity: 62, promiseSatisfaction: 80, prose: 86 }
    });

    expect(report.openFindingCount).toBe(1);
    expect(report.qualityScore.continuity).toBe(62);
    expect(report.profile.enabledCategories).toEqual(['continuity']);
  });

  it('creates revision suggestions and false-positive records from findings', () => {
    const finding = createReviewFinding({
      manuscriptVersionId: 'artifact_version_2',
      category: 'voice',
      severity: 'Medium',
      problem: 'The narrator tone drifts.',
      evidenceCitations: [{ sourceId: 'chapter_2', quote: 'voice drift' }],
      impact: 'Weakens chapter cohesion.',
      fixOptions: ['Restore clipped narration'],
      autoFixRisk: 'Medium'
    });

    const suggestion = createRevisionSuggestion({
      findingId: finding.id,
      manuscriptVersionId: finding.manuscriptVersionId,
      title: 'Restore narrator tone',
      rationale: 'Matches the established voice profile.',
      diff: {
        before: 'The room was very nice.',
        after: 'The room held its breath.'
      },
      risk: 'Medium'
    });
    const falsePositive = createFalsePositiveRecord({
      findingId: finding.id,
      reason: 'Intentional tone break',
      decidedBy: 'author'
    });

    expect(suggestion.status).toBe('Proposed');
    expect(suggestion.diff.after).toContain('held its breath');
    expect(falsePositive.status).toBe('FalsePositive');
  });
});
