import { existsSync } from 'fs';
import { test as setup, expect } from './fixtures/base';
import { authFile } from './fixtures/helpers';

// Authenticate with wallet once in "setup" so we don't have to do it over and
// over for each test file.
//
// Note: this step presently runs with chromium, even if running tests for
// msedge/firefox, as the 'setup' project doesn't know which project we're
// running with when using `--project` on CLI.
setup('authenticate', async ({ page }) => {
  setup.skip(existsSync(authFile), 'Already authenticated');

  const { TEST_WALLET_ORIGIN, TEST_WALLET_USERNAME, TEST_WALLET_PASSWORD } =
    process.env;

  expect(TEST_WALLET_ORIGIN).toBeDefined();
  expect(TEST_WALLET_USERNAME).toBeDefined();
  expect(TEST_WALLET_PASSWORD).toBeDefined();

  await page.goto(`${TEST_WALLET_ORIGIN}/auth/login`);
  await page.getByLabel('E-mail').fill(TEST_WALLET_USERNAME);
  await page.getByLabel('Password').fill(TEST_WALLET_PASSWORD);
  await page.getByRole('button', { name: 'login' }).click();
  await page.waitForURL(TEST_WALLET_ORIGIN);

  await page.goto(`${TEST_WALLET_ORIGIN}/settings/developer-keys`);
  await expect(page.locator('h1')).toHaveText('Developer Keys');

  await page.context().storageState({ path: authFile });
});
