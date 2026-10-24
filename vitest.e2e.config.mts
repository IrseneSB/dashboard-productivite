import { defineConfig } from 'vitest/config';

// End-to-end tests start the real Electron app, so they are slower and run
// separately from the unit and integration tests (`npm run test:e2e`).
export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
