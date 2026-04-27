import { createProject } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import {
  ObservabilityRepository,
  type ObservabilityMetricSnapshot
} from '../repositories/observability.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('ObservabilityRepository', () => {
  it('upserts snapshots, loads the latest project snapshot, and lists snapshots by time window', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Signal City',
      language: 'en-US',
      targetAudience: 'observability-minded authors'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new ObservabilityRepository(database.db);

    const firstSnapshot: ObservabilityMetricSnapshot = {
      id: 'observability_snapshot_1',
      projectId: project.id,
      windowStartAt: '2026-04-27T00:00:00.000Z',
      windowEndAt: '2026-04-27T01:00:00.000Z',
      capturedAt: '2026-04-27T01:05:00.000Z',
      cost: { totalUsd: 0.24, averageUsdPerRun: 0.12 },
      latency: { averageDurationMs: 400, p95DurationMs: 725 },
      tokens: { total: 4100, averagePerRun: 2050 },
      quality: {
        acceptedRate: 0.5,
        openIssueCount: 1,
        highSeverityOpenCount: 1,
        outcomes: { accepted: 1, needs_revision: 1 }
      },
      adoption: {
        adoptedRate: 0.5,
        partialRate: 0.5,
        rejectedRate: 0,
        byFeature: {
          drafting: { adopted: 1, partial: 1, rejected: 0 }
        }
      },
      modelUsage: [
        {
          modelProvider: 'openai',
          modelName: 'gpt-4.1',
          runCount: 2,
          totalTokens: 4100,
          totalCostUsd: 0.24
        }
      ],
      runErrors: [
        {
          code: 'RATE_LIMIT',
          count: 1,
          retryableCount: 1,
          maxSeverity: 'Warning'
        }
      ],
      workflowBottlenecks: [
        {
          workflowType: 'draft',
          stepName: 'revise',
          runCount: 2,
          averageDurationMs: 900,
          failureRate: 0.5,
          retryPressure: 2
        }
      ],
      dataQuality: {
        openIssueCount: 1,
        highSeverityOpenCount: 1,
        bySource: { retrieval: 1 },
        bySeverity: { High: 1 },
        unresolved: [
          {
            id: 'issue_1',
            projectId: project.id,
            source: 'retrieval',
            severity: 'High',
            status: 'Open',
            message: 'Missing required context'
          }
        ]
      },
      sourceRunIds: ['agent_run_1', 'agent_run_2']
    };
    const secondSnapshot: ObservabilityMetricSnapshot = {
      ...firstSnapshot,
      id: 'observability_snapshot_2',
      windowStartAt: '2026-04-27T01:00:00.000Z',
      windowEndAt: '2026-04-27T02:00:00.000Z',
      capturedAt: '2026-04-27T02:05:00.000Z',
      cost: { totalUsd: 0.4, averageUsdPerRun: 0.2 },
      sourceRunIds: ['agent_run_3']
    };

    await repository.upsert(firstSnapshot);
    await repository.upsert(secondSnapshot);
    await repository.upsert({
      ...firstSnapshot,
      cost: { totalUsd: 0.3, averageUsdPerRun: 0.15 },
      capturedAt: '2026-04-27T01:10:00.000Z',
      sourceRunIds: ['agent_run_1', 'agent_run_2', 'agent_run_4']
    });

    await expect(repository.getLatestByProject(project.id)).resolves.toEqual(secondSnapshot);
    await expect(
      repository.listByProjectWindow(project.id, {
        windowStartAt: '2026-04-27T00:00:00.000Z',
        windowEndAt: '2026-04-27T01:30:00.000Z'
      })
    ).resolves.toEqual([
      {
        ...firstSnapshot,
        cost: { totalUsd: 0.3, averageUsdPerRun: 0.15 },
        capturedAt: '2026-04-27T01:10:00.000Z',
        sourceRunIds: ['agent_run_1', 'agent_run_2', 'agent_run_4']
      }
    ]);
    await expect(repository.getLatestByProject('project_missing')).resolves.toBeNull();

    database.client.close();
  });
});
