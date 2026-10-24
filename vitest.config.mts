import { defineConfig } from 'vitest/config';

// Tests run in plain Node.js (no Electron window): domain, use cases and the
// SQLite store are all testable without starting the desktop app.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
