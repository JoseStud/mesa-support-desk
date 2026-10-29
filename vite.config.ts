import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  server: { proxy: { '/api': process.env.MESA_API_PROXY_TARGET || 'http://127.0.0.1:8000' } },
  preview: { proxy: { '/api': process.env.MESA_API_PROXY_TARGET || 'http://127.0.0.1:8000' } },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
