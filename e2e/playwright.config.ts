import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E config (spec Section 23).
 * Runs against the local docker-compose stack: `docker compose up -d` +
 * migrate + seed first, then `npx playwright test` from ./e2e.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
