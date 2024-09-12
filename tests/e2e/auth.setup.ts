import { test as setup, expect } from './fixtures/base';
import { authFile } from './fixtures/helpers';

// Authenticate with wallet once in "setup" so we don't have to do it over and
// over for each test file.
setup('authenticate', async ({ page }) => {
  const { WALLET_URL_ORIGIN, WALLET_USERNAME, WALLET_PASSWORD } = process.env;

  expect(WALLET_URL_ORIGIN).toBeDefined();
  expect(WALLET_USERNAME).toBeDefined();
  expect(WALLET_PASSWORD).toBeDefined();

  await page.goto(`${WALLET_URL_ORIGIN!}/auth/login`);
  await page.getByLabel('E-mail').fill(WALLET_USERNAME!);
  await page.getByLabel('Password').fill(WALLET_PASSWORD!);
  await page.getByRole('button', { name: 'login' }).click();
  await page.waitForURL(WALLET_URL_ORIGIN!);

  await page.goto(`${WALLET_URL_ORIGIN!}/settings/developer-keys`);
  await expect(page.locator('h1')).toHaveText('Developer Keys');

  await page.context().storageState({ path: authFile });
});
