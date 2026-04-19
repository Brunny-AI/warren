import { defineWorkersProject } from '@cloudflare/vitest-pool-workers/config';
import { defineConfig } from 'vitest/config';

// Two-project setup so unit tests stay on the fast node
// runner, while integration tests run inside a real Workers
// runtime (miniflare) with D1 + KV bound. Keeps the unit-test
// dev loop under a second, while integration suite can
// exercise the full signup → confirm → admin-stats flow
// end-to-end against an in-memory D1.

const unitProject = defineConfig({
  test: {
    name: 'unit',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    environment: 'node',
  },
});

const integrationProject = defineWorkersProject({
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityDate: '2024-09-23',
        },
      },
    },
  },
});

export default defineConfig({
  test: {
    projects: [unitProject, integrationProject],
    reporters: 'default',
  },
});
