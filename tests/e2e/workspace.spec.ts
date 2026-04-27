import { expect, test } from '@playwright/test';

test('workspace dashboard loads', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'AI Novel Workspace' })).toBeVisible();
  await expect(page.getByText('Current Project')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manuscript Editor' })).toBeVisible();
  await expect(page.getByText('Decision Queue')).toBeVisible();
  await expect(page.getByText('Review Center')).toBeVisible();
  await expect(page.getByText('Serialization Desk')).toBeVisible();
  await expect(page.getByText('Observability')).toBeVisible();
});

test('workspace has no horizontal overflow on desktop and mobile', async ({ browser }) => {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 1200 }
  ]) {
    const page = await browser.newPage({ viewport });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Manuscript Editor' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.close();
  }
});
