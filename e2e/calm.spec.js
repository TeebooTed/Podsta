import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ serviceWorkers: 'block', colorScheme: 'light' });

test('like counts stay with the author until the setting is off', async ({ page }) => {
  await page.goto('/preview/calm');
  await expect(page.getByRole('heading', { name: 'Likes preview' })).toBeVisible();
  const box = page.getByRole('checkbox', { name: /Hide like counts/ });
  await expect(box).toBeChecked();

  const yours = page.getByRole('article', { name: 'Your post' });
  const theirs = page.getByRole('article', { name: "Someone else's view" });
  await expect(yours.getByText(/3 likes/)).toBeVisible();
  await expect(theirs.getByText(/3 likes/)).toHaveCount(0);
  await expect(theirs.getByRole('button', { name: 'Like' })).toHaveAttribute('aria-pressed', 'true');

  await box.uncheck();
  await expect(box).not.toBeChecked();
  await expect(theirs.getByText(/3 likes/)).toBeVisible();
});

test('the likes setting meets WCAG AA', async ({ page }) => {
  await page.goto('/preview/calm');
  await expect(page.getByRole('heading', { name: 'Likes preview' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark' });

  test('the likes setting meets WCAG AA in dark mode', async ({ page }) => {
    await page.goto('/preview/calm');
    await expect(page.locator('html')).toHaveClass(/dark/);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
