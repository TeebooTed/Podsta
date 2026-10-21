import { test, expect } from '@playwright/test';

test('the app shell still opens when the network is gone', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Podsta', level: 1 })).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Podsta', level: 1 })).toBeVisible();
  await page.goto('/start');
  await expect(page.getByRole('heading', { name: /get you a pod/i })).toBeVisible();
});
