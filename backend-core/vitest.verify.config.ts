import { defineConfig } from 'vitest/config';

// Integration verification suite (spec Sections 23 + 24): walks repository
// source to assert the Section 7 contracts hold. No external services needed.
export default defineConfig({
  test: {
    include: ['test/verify/**/*.spec.ts'],
    environment: 'node',
  },
});
