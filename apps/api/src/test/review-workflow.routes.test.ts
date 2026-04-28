import { createDatabase, migrateDatabase, ProjectRepository, ReviewRepository } from '@ai-novel/db';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { PersistentProjectService } from '../services/project.service';
import { createInMemoryWorkbenchStores } from '../routes/workbench.routes';

describe('review workflow routes', () => {
  it('persists a review report and records finding actions that update lifecycle status', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projectService = new PersistentProjectService(new ProjectRepository(database.db));
    const project = await projectService.create({
      title: 'Review Project',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const app = buildApp({
      projectService,
      workbench: {
        ...createInMemoryWorkbenchStores(projectService),
        review: new ReviewRepository(database.db)
      }
    });

    const reportResponse = await app.inject({
      method: 'POST',
      url: `/projects/${project.id}/review/reports`,
      payload: {
        manuscriptVersionId: 'manuscript_version_seed',
        profile: { id: 'continuity', name: 'Continuity', enabledCategories: ['continuity'] },
        findings: [
          {
            manuscriptVersionId: 'manuscript_version_seed',
            category: 'continuity',
            severity: 'High',
            problem: 'Bell appears before it is introduced.',
            evidenceCitations: [{ sourceId: 'chapter_seed', quote: 'bell' }],
            impact: 'Breaks setup',
            fixOptions: ['Introduce the bell earlier'],
            autoFixRisk: 'Medium'
          }
        ],
        qualityScore: { overall: 62, continuity: 40, promiseSatisfaction: 70, prose: 80 }
      }
    });
    const report = reportResponse.json();
    const findingId = report.findings[0].id;

    const actionResponse = await app.inject({
      method: 'POST',
      url: `/review/findings/${findingId}/actions`,
      payload: {
        projectId: project.id,
        action: 'Accepted',
        decidedBy: 'operator',
        reason: 'Valid issue'
      }
    });

    const reloaded = await app.inject({
      method: 'GET',
      url: `/projects/${project.id}/review/reports/${report.id}`
    });

    expect(reportResponse.statusCode).toBe(201);
    expect(actionResponse.statusCode).toBe(200);
    expect(actionResponse.json()).toMatchObject({
      findingId,
      action: 'Accepted',
      nextStatus: 'Accepted'
    });
    expect(reloaded.json().findings[0]).toMatchObject({ id: findingId, status: 'Accepted' });
    expect(reloaded.json().openFindingCount).toBe(0);

    database.client.close();
    await app.close();
  });
});
