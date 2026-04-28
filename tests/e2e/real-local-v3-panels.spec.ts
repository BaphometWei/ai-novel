import { expect, test, type APIRequestContext } from '@playwright/test';

const apiBaseUrl = 'http://127.0.0.1:4000';

test('real local API backup panel creates verifies and restores a chapter bundle without route mocks', async ({
  page,
  request
}) => {
  const project = await createProjectWithChapter(request);
  const restoredProjectId = `project_e2e_restored_${test.info().workerIndex}_${Date.now()}`;

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Portable Bundle Desk' })).toBeVisible();
  await page.getByLabel('Project id', { exact: true }).fill(project.id);
  await page.getByLabel('Reason').fill('real local panel coverage');
  await page.getByLabel('Requested by').fill('playwright');

  await page.getByRole('button', { name: 'Create backup' }).click();
  const createResult = page.getByLabel('Backup create result');
  await expect(createResult).toContainText('created');
  await expect(createResult).toContainText(/backups[\\/].+\.json/);

  const backupPathInput = page.getByLabel('Backup path');
  await expect(backupPathInput).toHaveValue(/backups[\\/].+\.json/);

  await page.getByRole('button', { name: 'Verify backup' }).click();
  const verifyResult = page.getByLabel('Backup verify result');
  await expect(verifyResult).toContainText('verified');
  await expect(verifyResult).toContainText(/backup_[a-z0-9]+/i);

  await page.getByLabel('Target project id', { exact: true }).fill(restoredProjectId);
  await page.getByRole('button', { name: 'Restore backup' }).click();
  const restoreResult = page.getByLabel('Backup restore result');
  await expect(restoreResult).toContainText('restored');
  await expect(restoreResult).toContainText(restoredProjectId);

  const restoredProjectResponse = await request.get(`${apiBaseUrl}/projects/${restoredProjectId}`);
  expect(restoredProjectResponse.ok(), await restoredProjectResponse.text()).toBe(true);
  await expect
    .poll(async () => {
      const chaptersResponse = await request.get(`${apiBaseUrl}/projects/${restoredProjectId}/chapters`);
      if (!chaptersResponse.ok()) return [];
      return (await chaptersResponse.json()) as Array<{ title: string }>;
    })
    .toEqual([expect.objectContaining({ title: 'Backup source chapter' })]);
});

test('real local API drives V3 intelligence governance scheduling review and import export panels', async ({
  page,
  request
}) => {
  const project = await ensureFirstProjectWithNarrative(request);
  await upsertDueScheduledBackupPolicy(request, project.id);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Version History' })).toBeVisible();
  await page.getByRole('button', { name: 'Create snapshot' }).click();
  await expect(page.getByText('Snapshot created.')).toBeVisible();
  await expect(page.getByLabel('Version history detail')).toContainText('canon_1 -> chapter_1: grounds');

  await expect(page.getByRole('heading', { name: 'Narrative Intelligence' })).toBeVisible();
  await expect(page.getByLabel('Reader promise readiness')).toContainText('Mira promises to return the silver key.');
  await expect(page.getByLabel('Closure blockers')).toContainText('blockers');

  await expect(page.getByRole('heading', { name: 'Governance Audit' })).toBeVisible();
  await expect(page.getByLabel('Allowed authorship transition')).toContainText('Allowed');
  await expect(page.getByLabel('Blocked authorship transition')).toContainText('Blocked');

  await expect(page.getByRole('heading', { name: 'Retrieval Evaluation' })).toBeVisible();
  await expect(page.getByLabel('Retrieval quality thresholds')).toContainText('synthetic-local-defaults');
  await expect(page.getByLabel('Passing retrieval case')).toContainText('case_retrieval_pass');
  await expect(page.getByLabel('Failing retrieval case')).toContainText('case_retrieval_fail');

  await expect(page.getByRole('heading', { name: 'Branch & Retcon' })).toBeVisible();
  await expect(page.getByLabel('Branch scenario projection')).toContainText('Moonlit Archive Branch');
  await expect(page.getByLabel('Retcon proposal')).toContainText('Failed');

  await expect(page.getByRole('heading', { name: 'Review Learning' })).toBeVisible();
  await page.getByRole('button', { name: 'Run recheck' }).click();
  await expect(page.getByLabel('Review learning actions')).toContainText('Regressions 0');
  await expect(page.getByLabel('Revision lifecycle statuses')).toContainText('review_finding_open -> review_finding_current');

  await expect(page.getByRole('heading', { name: 'Scheduled Backups' })).toBeVisible();
  await expect(page.getByLabel('Scheduled backup policies')).toContainText('policy_daily');
  await expect(page.getByLabel('Due backup intents')).toContainText(project.id);
  await expect(page.getByLabel('Due backup intents')).toContainText('memory://backups');
  await page.getByRole('button', { name: 'Mark success' }).click();
  await expect(page.getByLabel('Scheduled backup run result')).toContainText('Run Succeeded');

  await expect(page.getByRole('heading', { name: 'Portable Bundle Desk' })).toBeVisible();
  await page.getByRole('button', { name: 'Export bundle' }).click();
  const exportResult = page.getByLabel('Export bundle result').locator('pre');
  await expect(exportResult).toContainText('export_job_');
  const exported = JSON.parse((await exportResult.textContent()) ?? '{}') as { bundle?: { uri?: string } };
  await page.getByLabel('Import source URI').fill(exported.bundle?.uri ?? `db://${project.id}.zip`);
  await page.getByLabel('Import mode').selectOption('replace');
  await page.getByRole('button', { name: 'Import bundle' }).click();
  await expect(page.getByLabel('Import job result')).toContainText('import_job_');
  await expect(page.getByLabel('Import job result')).toContainText('replace');
});

async function createProjectWithChapter(request: APIRequestContext): Promise<{ id: string }> {
  const projectResponse = await request.post(`${apiBaseUrl}/projects`, {
    data: {
      title: 'Real Local Backup Panel',
      language: 'en-US',
      targetAudience: 'serial fiction readers'
    }
  });
  expect(projectResponse.status(), await projectResponse.text()).toBe(201);
  const project = (await projectResponse.json()) as { id: string };

  const chapterResponse = await request.post(`${apiBaseUrl}/projects/${project.id}/chapters`, {
    data: {
      title: 'Backup source chapter',
      order: 1,
      body: 'The archive door clue is preserved across the backup restore path.',
      status: 'Accepted',
      metadata: { source: 'real-local-v3-panel' }
    }
  });
  expect(chapterResponse.status(), await chapterResponse.text()).toBe(201);

  return project;
}

async function ensureFirstProjectWithNarrative(request: APIRequestContext): Promise<{ id: string }> {
  const projectsResponse = await request.get(`${apiBaseUrl}/projects`);
  expect(projectsResponse.status(), await projectsResponse.text()).toBe(200);
  const projects = (await projectsResponse.json()) as Array<{ id: string }>;
  const project = projects[0] ?? (await createProjectWithChapter(request));

  const chapterResponse = await request.post(`${apiBaseUrl}/projects/${project.id}/chapters`, {
    data: {
      title: `Narrative source ${Date.now()}`,
      order: 1,
      body: 'Mira promises to return the silver key. The city waits for the oath to pay off.',
      status: 'Accepted',
      metadata: { source: 'real-local-v3-intelligence-panel' }
    }
  });
  expect(chapterResponse.status(), await chapterResponse.text()).toBe(201);
  const chapter = (await chapterResponse.json()) as { version: { id: string } };

  const extractionResponse = await request.post(`${apiBaseUrl}/projects/${project.id}/narrative-intelligence/extract-from-version`, {
    data: {
      manuscriptVersionId: chapter.version.id,
      sourceRunId: 'agent_run_e2e_narrative'
    }
  });
  expect(extractionResponse.status(), await extractionResponse.text()).toBe(201);

  return project;
}

async function upsertDueScheduledBackupPolicy(request: APIRequestContext, projectId: string): Promise<void> {
  const response = await request.put(`${apiBaseUrl}/scheduled-backups/policies/policy_daily`, {
    data: {
      projectId,
      cadence: 'daily',
      targetPathPrefix: 'memory://backups',
      enabled: true,
      nextRunAt: '2026-04-27T11:00:00.000Z',
      retentionCount: 7
    }
  });
  expect(response.status(), await response.text()).toBe(200);
}
