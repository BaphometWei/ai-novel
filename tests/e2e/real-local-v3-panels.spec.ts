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
