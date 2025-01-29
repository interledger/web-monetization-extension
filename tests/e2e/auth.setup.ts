import { existsSync } from 'node:fs';
import { test as setup, expect } from '@playwright/test';
import { authFile } from './fixtures/helpers';
import { getJWKS } from '@/shared/helpers';
import type { JWK } from '@interledger/open-payments';

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

setup('validate test wallet has provided keys added', async () => {
  const {
    TEST_WALLET_ADDRESS_URL,
    TEST_WALLET_KEY_ID,
    TEST_WALLET_PUBLIC_KEY,
  } = process.env;

  expect(TEST_WALLET_ADDRESS_URL).toBeDefined();
  expect(TEST_WALLET_KEY_ID).toBeDefined();
  expect(TEST_WALLET_PUBLIC_KEY).toBeDefined();

  const jwks = await getJWKS(TEST_WALLET_ADDRESS_URL);
  expect(jwks.keys.length).toBeGreaterThan(0);

  const key = jwks.keys.find((key) => key.kid === TEST_WALLET_KEY_ID);
  expect(key).toBeDefined();
  const { x } = JSON.parse(atob(TEST_WALLET_PUBLIC_KEY)) as JWK;
  expect(key).toMatchObject({ kid: TEST_WALLET_KEY_ID, x });
});
