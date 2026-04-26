import { expect, test } from '@playwright/test';

test('workspace dashboard loads', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'AI Novel Workspace' })).toBeVisible();
  await expect(page.getByText('Current Project')).toBeVisible();
  await expect(page.getByText('Decision Queue')).toBeVisible();
  await expect(page.getByText('Review Center')).toBeVisible();
  await expect(page.getByText('Serialization Desk')).toBeVisible();
});
