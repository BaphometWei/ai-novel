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
  const projectId = projectIdFromChapterUrl(createChapterResponse.url());
  const createdChapter = await createChapterResponse.json();
  const chapterId = createdChapter.chapter.id as string;
  await expect(page.getByRole('treeitem', { name: /New working chapter/i })).toBeVisible();

  await page.getByRole('button', { name: 'Generate draft' }).click();
  const draftEditor = page.getByRole('textbox', { name: 'Scene draft editor' });
  await expect(draftEditor).toContainText('Deterministic writing draft');

  await page.getByRole('button', { name: 'Accept draft into manuscript' }).click();
  const pendingNotice = page.getByText(/Pending approval for manuscript_version_/);
  await expect(pendingNotice).toBeVisible();
  const versionId = /manuscript_version_[a-z0-9]+/i.exec((await pendingNotice.textContent()) ?? '')?.[0];
  expect(versionId).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Run Inspector' })).toBeVisible();

  const approvalsResponse = await request.get(`${apiBaseUrl}/approvals`);
  expect(approvalsResponse.ok()).toBe(true);
  const approvals = ((await approvalsResponse.json()) as { items: Array<{ id: string; projectId: string; reason: string }> })
    .items;
  const approval = approvals.find((item) => item.projectId === projectId && item.reason.includes(versionId!));
  expect(approval).toBeTruthy();

  const approved = await request.post(`${apiBaseUrl}/approvals/${approval!.id}/approve`, {
    data: { decidedBy: 'playwright' }
  });
  expect(approved.ok()).toBe(true);

  await expect
    .poll(async () => {
      const currentBody = await request.get(`${apiBaseUrl}/chapters/${chapterId}/current-body`);
      if (!currentBody.ok()) return '';
      return ((await currentBody.json()) as { body: string }).body;
    })
    .toContain('Deterministic writing draft');

  const observability = await request.get(`${apiBaseUrl}/projects/${projectId}/observability/summary`);
  expect(observability.ok()).toBe(true);
  const summary = (await observability.json()) as { modelUsage: unknown[]; quality: { acceptedRate: number } };
  expect(summary.modelUsage.length).toBeGreaterThan(0);
  expect(summary.quality.acceptedRate).toBeGreaterThan(0);
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

function projectIdFromChapterUrl(url: string): string {
  const match = /\/projects\/([^/]+)\/chapters/.exec(new URL(url).pathname);
  expect(match?.[1]).toBeTruthy();
  return match![1];
}
