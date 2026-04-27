import { expect, test, type APIRequestContext } from '@playwright/test';

const apiBaseUrl = 'http://127.0.0.1:4000';

test('real local API workflow creates a chapter, generates a deterministic draft, and accepts it', async ({
  page,
  request
}) => {
  await ensureProjectExists(request);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Manuscript Editor' })).toBeVisible();
  const createChapterResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/projects/') && response.url().includes('/chapters') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'New chapter' }).click();
  const createChapterResponse = await createChapterResponsePromise;
  expect(createChapterResponse.status(), await createChapterResponse.text()).toBe(201);
  await expect(page.getByRole('treeitem', { name: /New working chapter/i })).toBeVisible();

  await page.getByRole('button', { name: 'Generate draft' }).click();
  const draftEditor = page.getByRole('textbox', { name: 'Scene draft editor' });
  await expect(draftEditor).toContainText('Deterministic writing draft');

  await page.getByRole('button', { name: 'Accept draft into manuscript' }).click();
  await expect(page.getByText(/Accepted as manuscript_version_/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Run Inspector' })).toBeVisible();
});

async function ensureProjectExists(request: APIRequestContext) {
  const existingProjects = await request.get(`${apiBaseUrl}/projects`);
  expect(existingProjects.ok()).toBe(true);
  if ((await existingProjects.json()).length > 0) return;

  const created = await request.post(`${apiBaseUrl}/projects`, {
    data: {
      title: 'E2E Local Acceptance',
      language: 'en-US',
      targetAudience: 'serial fiction readers'
    }
  });
  expect(created.status()).toBe(201);
}
