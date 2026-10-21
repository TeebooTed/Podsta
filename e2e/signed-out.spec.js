import { test, expect } from '@playwright/test';

test('signed-out home explains how to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Podsta', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /don't have a Pod/i })).toBeVisible();
});

test('the no-pod guide is a real page', async ({ page }) => {
  await page.goto('/start');
  await expect(page.getByRole('heading', { name: /don't have a Pod/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /continue on solid community/i })).toBeVisible();
});

test('an invite without a WebID does not crash', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/invite');
  await expect(page.getByRole('heading', { name: /missing a person/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a missing route still offers sign-in', async ({ page }) => {
  await page.goto('/not-a-page');
  await expect(page.getByRole('heading', { name: 'Podsta', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
});
