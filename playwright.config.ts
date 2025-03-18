import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { testDir, authFile } from './tests/e2e/fixtures/helpers';

if (!process.env.CI) {
  require('dotenv').config({ path: path.join(testDir, '.env') });
}

export default defineConfig({
  testDir,
  outputDir: path.join(testDir, 'test-results'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    [
      'html',
      { open: 'never', outputFolder: path.join(testDir, 'playwright-report') },
    ],
  ],
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        channel: 'chromium',
        storageState: authFile,
      },
      dependencies: ['setup'],
    },

    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
        channel: 'chrome',
      },
      dependencies: ['setup'],
    },

    // Firefox+Playwright doesn't work well enough at the moment.
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'], storageState: authFile },
    //   dependencies: ['setup'],
    // },

    // Safari is surely a no-go for now
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'], storageState: authFile },
    //   dependencies: ['setup'],
    // },

    {
      name: 'msedge',
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
