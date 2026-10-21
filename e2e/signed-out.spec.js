import { test, expect } from '@playwright/test';

test('signed-out home leads with create my pod', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Podsta', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create my Pod' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /already have an account/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SolidWeb' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Advanced' }).click();
  await expect(page.getByRole('button', { name: 'SolidWeb' })).toBeVisible();
});

test('the no-pod guide is a real page', async ({ page }) => {
  await page.goto('/start');
  await expect(page.getByRole('heading', { name: /get you a pod/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /continue to solid community/i })).toBeVisible();
});

test('an invite without a WebID does not crash', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/invite');
  await expect(page.getByRole('heading', { name: /invite is missing someone/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a missing route still offers create and sign-in', async ({ page }) => {
  await page.goto('/not-a-page');
  await expect(page.getByRole('heading', { name: 'Podsta', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create my Pod' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^sign in\b/i }).first()).toBeVisible();
});
