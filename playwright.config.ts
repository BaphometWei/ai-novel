import { defineConfig, devices } from '@playwright/test';

const e2eRunId = process.env.AI_NOVEL_E2E_RUN_ID ?? String(Date.now());
const e2eDbPath = process.env.AI_NOVEL_E2E_DB_PATH ?? `data/e2e-ai-novel-${e2eRunId}.sqlite`;

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'npm --workspace @ai-novel/api run dev',
      env: {
        AI_NOVEL_DB_PATH: e2eDbPath,
        OPENAI_API_KEY: 'sk-e2e-placeholder'
      },
      url: 'http://127.0.0.1:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: 'npm --workspace @ai-novel/web run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
