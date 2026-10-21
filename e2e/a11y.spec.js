import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PATHS = ['/', '/start', '/invite'];

test('signed-out pages meet WCAG AA', async ({ page }) => {
  for (const path of PATHS) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, `${path}\n${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
  }
});
