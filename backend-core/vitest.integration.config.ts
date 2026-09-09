import { defineConfig } from 'vitest/config';

// Integration tests: run against real Postgres + Redis (docker compose or CI services).
// Requires DATABASE_URL + REDIS_URL env vars and a migrated+seeded database.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.spec.ts'],
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxConcurrency: 1,
    fileParallelism: false,
  },
});
