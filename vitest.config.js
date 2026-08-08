import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  resolve: {
    alias: {
      // See tests/mocks/resend.js — hard-blocks any real network call to
      // Resend from anywhere in the suite, not just files that remember to
      // mock it themselves.
      resend: fileURLToPath(new URL('./tests/mocks/resend.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    testTimeout: 10000,
    // Never touch the real DB/Resend by accident — every test in this suite
    // mocks its DAO/service dependencies. If a test needs the real DB, it
    // belongs in a separate, explicitly-named live/integration run, not here.
    include: ['tests/**/*.test.js'],
  },
});
