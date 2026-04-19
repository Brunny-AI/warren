/**
 * Warren dogfood walkthrough — primary user paths.
 *
 * Runs against `wrangler dev --port 8788` (default) or override
 * via WARREN_BASE_URL env. Per .claude/rules/dogfood-with-playwright.md
 * Round 1 scope: chrome (Nav/Footer themed) + signup happy + error.
 *
 * Use ARIA-role selectors over CSS classes so antd Form internal
 * class changes don't break the spec.
 */

import { test, expect } from '@playwright/test';

test.describe('Chrome', () => {
  test('home page loads with nav landmark + footer', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByText('brunny.ai').first()).toBeVisible();
  });

  test('nav links route to each page with aria-current', async ({ page }) => {
    const routes: Array<[string, RegExp]> = [
      ['/products', /products/i],
      ['/team', /team/i],
      ['/contact', /contact/i],
    ];
    await page.goto('/');
    // Scope to the Main navigation landmark. Home-page body also
    // contains card anchors whose labels overlap nav link names
    // (e.g. pill text or card headings), and antd Menu's <li>
    // wrapping leaves the <a> with a smaller clickable geometry
    // than the list item — unscoped `.first()` picks up the wrong
    // element and scroll-into-view lands the click under the
    // header's block bounds. R2 dogfood surfaced this, 2026-04-19.
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const [path, label] of routes) {
      await nav.getByRole('link', { name: label }).first().click();
      await expect(page).toHaveURL(new RegExp(path + '/?$'));
      await expect(
        nav.getByRole('link', { name: label, current: 'page' }).first(),
      ).toBeVisible();
    }
  });
});

test.describe('Signup form on /products', () => {
  test('rejects empty submission via antd Form validation', async ({
    page,
  }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: /notify me/i }).click();
    await expect(
      page.getByText(/required/i).first(),
    ).toBeVisible({ timeout: 3000 });
  });

  test('rejects malformed email via antd Form validation', async ({
    page,
  }) => {
    await page.goto('/products');
    await page.getByRole('textbox', { name: /email/i }).fill('not-an-email');
    await page.getByRole('button', { name: /notify me/i }).click();
    await expect(
      page.getByText(/invalid email/i).first(),
    ).toBeVisible({ timeout: 3000 });
  });

  test('accepts valid email — surfaces success or graceful error', async ({
    page,
  }) => {
    await page.goto('/products');
    const stamp = Date.now();
    await page
      .getByRole('textbox', { name: /email/i })
      .fill(`dogfood+${stamp}@brunny.ai`);
    await page.getByRole('button', { name: /notify me/i }).click();
    // Accept either backend success OR explicit graceful error
    // (e.g., if D1 binding missing locally — backend returns 500
    // with { error: '...' } message; UI surfaces it).
    const status = page.getByRole('status');
    await expect(status).toBeVisible({ timeout: 5000 });
    await expect(status).toHaveText(
      /(check your email|signed up|subscribed|signup failed|try again)/i,
    );
  });

  test('SSR HTML carries native form attrs for no-JS path', async ({
    page,
  }) => {
    const response = await page.goto('/products');
    expect(response?.status()).toBe(200);
    const html = (await response?.text()) ?? '';
    // Per pre-pr-peer-review.md a11y-parity rule: native form
    // attributes must persist in SSR HTML so visitors without JS
    // can still POST the signup.
    expect(html).toContain('action="/api/signup"');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('name="source"');
  });
});

test.describe('/log (changelog)', () => {
  test('renders heading + ship-rate stats + feed entries', async ({
    page,
  }) => {
    await page.goto('/log');

    // Heading is the page identity. Anchors every other assertion
    // against a page that's actually /log and not a 404/redirect.
    await expect(
      page.getByRole('heading', { name: /^log$/i, level: 1 }),
    ).toBeVisible();

    // Ship-rate banner (PR #64) renders 3 stat cards with uppercase
    // labels. Regression gate for the mini-dashboard header.
    for (const label of ['last 24h', 'last 7 days', 'in this window']) {
      await expect(
        page.getByRole('term').filter({ hasText: new RegExp(label, 'i') }),
      ).toBeVisible();
    }

    // Feed list is the page's point; at least one entry must render
    // (log.json has 25 seeds). Scoped to the feed landmark so the
    // assertion doesn't over-match.
    const feed = page.getByRole('list', { name: 'Recent shipped commits' });
    await expect(feed).toBeVisible();
    const entries = feed.locator('li.entry');
    await expect(entries.first()).toBeVisible();

    // At least one commit SHA link points at the github commits page.
    // Confirms the log.json schema is rendering correctly.
    await expect(
      feed.getByRole('link').filter({ hasText: /^[0-9a-f]{7,}$/ }).first(),
    ).toBeVisible();
  });

  test('hero "peek at the bus" CTA routes to /log', async ({ page }) => {
    await page.goto('/');
    const cta = page
      .getByRole('link', { name: /peek at the bus/i })
      .first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/log\/?$/);
  });
});

test.describe('/team (recent-activity chips)', () => {
  test('each agent card surfaces a "last shipped" chip', async ({ page }) => {
    await page.goto('/team');

    // Baseline: page renders + team list landmark present.
    await expect(
      page.getByRole('list', { name: 'The team' }),
    ).toBeVisible();

    // PR #62 adds a "last shipped" label chip per card for agents
    // present in log.json. Assert the label appears at least once;
    // the set of which agents have recent commits drifts on every
    // deploy, so we don't pin specific names.
    const shipLabels = page.locator('.last-ship-label');
    const count = await shipLabels.count();
    expect(count).toBeGreaterThanOrEqual(1);
    await expect(shipLabels.first()).toHaveText(/last shipped/i);
  });
});
