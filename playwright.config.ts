/**
 * Playwright config for warren dogfood harness.
 *
 * Targets local wrangler dev (production-mode SSR via miniflare,
 * not astro dev — see docs/DOGFOOD.md for why npm run dev has a
 * Vite optimization race that wrangler dev avoids).
 *
 * Chromium-only by default. Add --project=firefox via CLI for
 * cross-browser dogfood rounds.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts/dogfood',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.WARREN_BASE_URL ?? 'http://localhost:8788',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
