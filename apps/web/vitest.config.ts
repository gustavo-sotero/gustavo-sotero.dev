import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Stubs for Next.js build-time guards that throw in Vitest/Node environment
      'server-only': fileURLToPath(new URL('./src/__mocks__/server-only.ts', import.meta.url)),
      'client-only': fileURLToPath(new URL('./src/__mocks__/client-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // Avoid intermittent worker-fork crashes observed on some environments.
    pool: 'threads',
  },
});
