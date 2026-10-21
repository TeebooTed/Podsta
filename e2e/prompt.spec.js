import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block', colorScheme: 'light' });

test('the weekly prompt can be skipped until next week', async ({ page }) => {
  await page.goto('/preview/prompt');
  await expect(page.getByRole('heading', { name: 'Prompt preview' })).toBeVisible();
  const card = page.getByRole('region', { name: "This week's photo prompt" });
  await expect(card.getByRole('heading', { name: 'Something green' })).toBeVisible();
  await card.getByRole('button', { name: 'Make a post' }).click();
  await expect(page.getByText('Composer opened. The caption was left empty.')).toBeVisible();
  await card.getByRole('button', { name: 'Not this week' }).click();
  await expect(page.getByText('Hidden for this week.')).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Hidden for this week.')).toBeVisible();
  await expect(page.getByRole('region', { name: "This week's photo prompt" })).toHaveCount(0);
});

test('the weekly prompt meets WCAG AA', async ({ page }) => {
  await page.goto('/preview/prompt');
  await expect(page.getByRole('region', { name: "This week's photo prompt" })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark' });

  test('the weekly prompt meets WCAG AA in dark mode', async ({ page }) => {
    await page.goto('/preview/prompt');
    await expect(page.locator('html')).toHaveClass(/dark/);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
