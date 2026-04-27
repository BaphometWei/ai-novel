import { buildReviewReport, createProject, createReviewFinding, createRevisionSuggestion } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ProjectRepository } from '../repositories/project.repository';
import { ReviewRepository } from '../repositories/review.repository';

describe('ReviewRepository', () => {
  it('persists review reports and revision suggestions for a project', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projectRepository = new ProjectRepository(database.db);
    const reviewRepository = new ReviewRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await projectRepository.save(project);

    const finding = createReviewFinding({
      manuscriptVersionId: 'artifact_version_1',
      category: 'continuity',
      severity: 'High',
      problem: 'A secret is used before reveal.',
      evidenceCitations: [{ sourceId: 'secret_1', quote: 'Reveal happens later.' }],
      impact: 'Breaks reader trust.',
      fixOptions: ['Move the line after reveal'],
      autoFixRisk: 'Medium'
    });
    const report = buildReviewReport({
      projectId: project.id,
      manuscriptVersionId: finding.manuscriptVersionId,
      profile: { id: 'profile_standard', name: 'Standard', enabledCategories: ['continuity'] },
      findings: [finding],
      qualityScore: { overall: 76, continuity: 60, promiseSatisfaction: 80, prose: 84 }
    });
    const suggestion = createRevisionSuggestion({
      findingId: finding.id,
      manuscriptVersionId: finding.manuscriptVersionId,
      title: 'Move secret use',
      rationale: 'Keep knowledge boundaries intact.',
      diff: { before: 'She names the hidden heir.', after: 'She suspects the hidden heir.' },
      risk: 'Medium'
    });

    await reviewRepository.saveReport(report);
    await reviewRepository.saveRevisionSuggestion(suggestion);

    const savedReport = await reviewRepository.findReportById(report.id);
    const savedSuggestion = await reviewRepository.findRevisionSuggestionById(suggestion.id);

    expect(savedReport?.findings[0]?.problem).toBe('A secret is used before reveal.');
    expect(savedReport?.openFindingCount).toBe(1);
    expect(savedSuggestion?.diff.after).toBe('She suspects the hidden heir.');
    database.client.close();
  });

  it('rejects revision suggestions for findings that were not saved in a review report', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const reviewRepository = new ReviewRepository(database.db);
    const suggestion = createRevisionSuggestion({
      findingId: 'review_finding_missing',
      manuscriptVersionId: 'artifact_version_1',
      title: 'Invalid suggestion',
      rationale: 'Should not persist without a finding.',
      diff: { before: 'before', after: 'after' },
      risk: 'Low'
    });

    await expect(reviewRepository.saveRevisionSuggestion(suggestion)).rejects.toThrow(/Review finding not found/);
    database.client.close();
  });
});
