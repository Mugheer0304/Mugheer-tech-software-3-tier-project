import { defineConfig } from 'vitest/config';

// Unit tests: fast, no external services, run on every PR.
export default defineConfig({
  test: {
    include: ['test/unit/**/*.spec.ts'],
    environment: 'node',
  },
});
