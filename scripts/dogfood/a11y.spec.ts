/**
 * Warren a11y smoke — axe-core scan of every public page.
 *
 * Critical/serious violations fail the test. Moderate/minor are
 * recorded but non-blocking (surface in HTML report). Per
 * .claude/rules/dogfood-with-playwright.md §Tooling.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/products', '/team', '/contact'];

for (const path of PAGES) {
  test(`a11y: ${path} has no critical or serious violations`, async ({
    page,
  }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(
      blocking,
      `Critical/serious a11y violations on ${path}:\n${JSON.stringify(blocking, null, 2)}`,
    ).toEqual([]);
  });
}
