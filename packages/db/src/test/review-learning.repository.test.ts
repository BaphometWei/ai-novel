import {
  buildRecurringIssueSummary,
  createProject,
  createReviewFinding,
  markReviewFindingAccepted
} from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ProjectRepository } from '../repositories/project.repository';
import { ReviewLearningRepository } from '../repositories/review-learning.repository';

describe('ReviewLearningRepository', () => {
  it('persists lifecycle events by project, profile, and category', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new ReviewLearningRepository(database.db);
    const finding = createReviewFinding({
      manuscriptVersionId: 'chapter_1_v1',
      category: 'continuity',
      severity: 'High',
      problem: 'The locked gate is open without explanation.',
      evidenceCitations: [{ sourceId: 'chapter_1', quote: 'The gate stood open.' }],
      impact: 'Breaks spatial continuity.',
      fixOptions: ['Seed a prior unlock beat'],
      autoFixRisk: 'Medium'
    });
    const transition = markReviewFindingAccepted(finding, {
      decidedBy: 'editor',
      rationale: 'Real continuity break.',
      decidedAt: '2026-04-27T13:00:00.000Z'
    });

    await repository.saveLifecycleEvent({
      projectId: project.id,
      profileId: 'profile_standard',
      category: finding.category,
      event: transition.event,
      findingSnapshot: transition.finding
    });

    await expect(repository.listLifecycleEvents(project.id, 'profile_standard', 'continuity')).resolves.toMatchObject([
      {
        projectId: project.id,
        profileId: 'profile_standard',
        category: 'continuity',
        event: {
          findingId: finding.id,
          kind: 'Accepted',
          rationale: 'Real continuity break.'
        },
        findingSnapshot: {
          status: 'Accepted',
          problem: 'The locked gate is open without explanation.'
        }
      }
    ]);
    database.client.close();
  });

  it('upserts recurring issue summaries by project, profile, and category', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new ReviewLearningRepository(database.db);
    const findings = [
      createRecurringFinding('finding_1', 'chapter_1'),
      createRecurringFinding('finding_2', 'chapter_2')
    ];
    const summary = buildRecurringIssueSummary(findings)[0];

    await repository.upsertRecurringIssueSummary({
      projectId: project.id,
      profileId: 'profile_standard',
      category: summary.category,
      summary,
      updatedAt: '2026-04-27T14:00:00.000Z'
    });
    await repository.upsertRecurringIssueSummary({
      projectId: project.id,
      profileId: 'profile_standard',
      category: summary.category,
      summary: { ...summary, occurrenceCount: 3, findingIds: [...summary.findingIds, 'finding_3'] },
      updatedAt: '2026-04-27T15:00:00.000Z'
    });

    await expect(repository.listRecurringIssueSummaries(project.id, 'profile_standard', 'continuity')).resolves.toMatchObject([
      {
        projectId: project.id,
        profileId: 'profile_standard',
        category: 'continuity',
        summary: {
          signature: summary.signature,
          occurrenceCount: 3,
          findingIds: ['finding_1', 'finding_2', 'finding_3']
        },
        updatedAt: '2026-04-27T15:00:00.000Z'
      }
    ]);
    database.client.close();
  });
});

function createRecurringFinding(id: string, chapterId: string) {
  return {
    ...createReviewFinding({
      manuscriptVersionId: `${chapterId}_v1`,
      category: 'continuity',
      severity: 'High',
      problem: 'The locked gate is open without explanation.',
      evidenceCitations: [{ sourceId: chapterId, quote: 'The gate stood open.' }],
      impact: 'Breaks spatial continuity.',
      fixOptions: ['Seed a prior unlock beat'],
      autoFixRisk: 'Medium'
    }),
    id
  };
}
