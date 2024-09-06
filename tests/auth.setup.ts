import { test as setup, expect } from './fixtures/base';
import { authFile } from './fixtures/helpers';

setup('authenticate', async ({ page }) => {
  const { WALLET_URL_ORIGIN, WALLET_USERNAME, WALLET_PASSWORD } = process.env;

  await page.goto(`${WALLET_URL_ORIGIN!}/auth/login`);
  await page.getByLabel('E-mail').fill(WALLET_USERNAME!);
  await page.getByLabel('Password').fill(WALLET_PASSWORD!);
  await page.getByRole('button', { name: 'login' }).click();
  await page.waitForURL(WALLET_URL_ORIGIN!);

  await page.goto(`${WALLET_URL_ORIGIN!}/settings/developer-keys`);
  await expect(page.locator('h1')).toHaveText('Developer Keys');

  await page.context().storageState({ path: authFile });
});
