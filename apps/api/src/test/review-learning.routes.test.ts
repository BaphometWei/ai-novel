import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';

function finding(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'review_finding_1',
    manuscriptVersionId: 'chapter_1_v1',
    category: 'Continuity',
    severity: 'Medium',
    problem: 'Compass changes color',
    evidenceCitations: [{ sourceId: 'chapter_1', quote: 'The compass was brass.' }],
    impact: 'Reader cannot track the object.',
    fixOptions: ['Keep the compass brass.'],
    autoFixRisk: 'Low',
    status: 'Open',
    ...overrides
  };
}

describe('review learning API routes', () => {
  it('summarizes recurring review issues from supplied findings', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/review-learning/recurring-issues',
      payload: {
        findings: [
          finding({ id: 'review_finding_1', manuscriptVersionId: 'chapter_1_v1' }),
          finding({ id: 'review_finding_2', manuscriptVersionId: 'chapter_2_v1', evidenceCitations: [{ sourceId: 'chapter_2', quote: 'The compass glowed blue.' }] }),
          finding({ id: 'review_finding_3', status: 'Rejected' })
        ],
        minimumOccurrences: 2
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      recurringIssues: [
        {
          signature: 'Continuity:compass changes color',
          category: 'Continuity',
          occurrenceCount: 2,
          chapterIds: ['chapter_1', 'chapter_2'],
          findingIds: ['review_finding_1', 'review_finding_2'],
          highestSeverity: 'Medium',
          trend: 'Recurring',
          risk: 'Medium'
        }
      ]
    });

    await app.close();
  });

  it('rechecks prior findings against changed manuscript findings and reports resolved, regressed, and still-open statuses', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/review-learning/recheck',
      payload: {
        checkedAt: '2026-04-27T12:00:00.000Z',
        previousManuscriptVersionId: 'chapter_1_v1',
        currentManuscriptVersionId: 'chapter_1_v2',
        previousFindings: [
          finding({ id: 'review_finding_resolved', status: 'Resolved', problem: 'Compass changes color' }),
          finding({ id: 'review_finding_fixed', status: 'Open', problem: 'Door opens twice' }),
          finding({ id: 'review_finding_open', status: 'Open', problem: 'Motive is unclear' })
        ],
        currentFindings: [
          finding({ id: 'review_finding_regressed_current', manuscriptVersionId: 'chapter_1_v2', problem: 'Compass changes color' }),
          finding({ id: 'review_finding_open_current', manuscriptVersionId: 'chapter_1_v2', problem: 'Motive is unclear' })
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      previousManuscriptVersionId: 'chapter_1_v1',
      currentManuscriptVersionId: 'chapter_1_v2',
      statuses: [
        {
          findingId: 'review_finding_resolved',
          status: 'Regressed',
          currentFindingId: 'review_finding_regressed_current'
        },
        {
          findingId: 'review_finding_fixed',
          status: 'Resolved'
        },
        {
          findingId: 'review_finding_open',
          status: 'StillOpen',
          currentFindingId: 'review_finding_open_current'
        }
      ],
      regressions: [
        {
          finding: { id: 'review_finding_resolved', status: 'Regression', manuscriptVersionId: 'chapter_1_v2' },
          event: {
            findingId: 'review_finding_resolved',
            kind: 'Regression',
            detectedByFindingId: 'review_finding_regressed_current',
            occurredAt: '2026-04-27T12:00:00.000Z'
          }
        }
      ]
    });

    await app.close();
  });

  it('rejects invalid review learning payloads', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/review-learning/recheck',
      payload: { previousFindings: [] }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid review learning payload' });

    await app.close();
  });

  it('persists recheck regressions and recurring issue summaries in the persistent runtime', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Review Learning Night',
        language: 'en-US',
        targetAudience: 'serial fiction readers'
      }
    });
    const projectId = projectResponse.json().id;

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/review-learning/recheck',
      payload: {
        projectId,
        profileId: 'review_profile_1',
        checkedAt: '2026-04-27T12:00:00.000Z',
        previousManuscriptVersionId: 'chapter_1_v1',
        currentManuscriptVersionId: 'chapter_1_v2',
        previousFindings: [
          finding({ id: 'review_finding_resolved', status: 'Resolved', problem: 'Compass changes color' })
        ],
        currentFindings: [
          finding({ id: 'review_finding_regressed_current', manuscriptVersionId: 'chapter_1_v2', problem: 'Compass changes color' }),
          finding({ id: 'review_finding_recurring', manuscriptVersionId: 'chapter_2_v1', evidenceCitations: [{ sourceId: 'chapter_2', quote: 'The compass glowed blue.' }] })
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    await expect(
      runtime.stores.reviewLearning.listLifecycleEvents(projectId, 'review_profile_1', 'Continuity')
    ).resolves.toMatchObject([
      {
        projectId,
        profileId: 'review_profile_1',
        category: 'Continuity',
        event: {
          findingId: 'review_finding_resolved',
          kind: 'Regression',
          detectedByFindingId: 'review_finding_regressed_current'
        }
      }
    ]);
    await expect(
      runtime.stores.reviewLearning.listRecurringIssueSummaries(projectId, 'review_profile_1', 'Continuity')
    ).resolves.toMatchObject([
      {
        projectId,
        profileId: 'review_profile_1',
        category: 'Continuity',
        summary: {
          signature: 'Continuity:compass changes color',
          findingIds: ['review_finding_regressed_current', 'review_finding_recurring']
        }
      }
    ]);

    await runtime.app.close();
    runtime.database.client.close();
  });
});
