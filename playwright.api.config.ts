import { defineConfig } from '@playwright/test';

const apiPython = process.env.MESA_API_PYTHON || 'backend/.venv/bin/python';
const quotedApiPython = `'${apiPython.replace(/'/g, "'\\''")}'`;

export default defineConfig({
  testDir: './tests/api-e2e',
  outputDir: 'test-results-api',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    trace: 'retain-on-failure',
    launchOptions: process.env.MESA_CHROMIUM_PATH
      ? { executablePath: process.env.MESA_CHROMIUM_PATH, args: ['--no-sandbox'] }
      : {},
  },
  projects: [{ name: 'chromium-api', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: `${quotedApiPython} -m uvicorn backend.app:app --host 127.0.0.1 --port 8001`,
      url: 'http://127.0.0.1:8001/api/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run preview:api -- --host 127.0.0.1 --port 4175',
      url: 'http://127.0.0.1:4175',
      env: { VITE_MESA_STORAGE: 'api', MESA_API_PROXY_TARGET: 'http://127.0.0.1:8001' },
      reuseExistingServer: false,
    },
  ],
});
