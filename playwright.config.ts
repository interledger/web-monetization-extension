import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { testDir, authFile } from './tests/e2e/fixtures/helpers';

if (!process.env.CI) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: path.join(testDir, '.env') });
}

export default defineConfig({
  testDir,
  outputDir: path.join(testDir, 'test-results'),
  // We don't want this set to true as that would make tests in each file to run
  // in parallel, which will cause conflicts with the "global state". With this
  // set to false and workers > 1, multiple test files can run in parallel, but
  // tests within a file are run at one at a time. We make extensive use of
  // worker-scope fixtures and beforeAll hooks to achieve best performance.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    [
      'html',
      { open: 'never', outputFolder: path.join(testDir, 'playwright-report') },
    ],
  ],
  use: { trace: 'on-first-retry' },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: authFile },
      dependencies: ['setup'],
    },

    // Firefox+Playwright doesn't work well enough at the moment.
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'], storageState: authFile },
    //   dependencies: ['setup'],
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'], storageState: authFile },
    //   dependencies: ['setup'],
    // },

    /* Test against branded browsers. */
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
