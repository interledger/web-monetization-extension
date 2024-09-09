import { test, expect } from './fixtures/connected';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test.only('should monetize site with single wallet address', async ({
  page,
  popup,
}) => {
  const walletAddressUrl = process.env.CONNECT_WALLET_ADDRESS_URL!;
  const playgroundUrl = 'https://webmonetization.org/play/';

  await page.goto(playgroundUrl);

  const monetizationCallback = (ev: any) => ev;
  await page.exposeFunction('monetizationCallback', monetizationCallback);

  await page
    .getByLabel('Wallet address/Payment pointer')
    .fill(walletAddressUrl);
  await page.getByRole('button', { name: 'Add monetization link' }).click();

  await expect(page.locator(`link[rel=monetization]`)).toHaveAttribute(
    'href',
    walletAddressUrl,
  );

  await page.waitForSelector('#link-events .log-header');
  await page.waitForSelector('#link-events ul.events li');
  await expect(page.locator('#link-events ul.events li').last()).toContainText(
    'Load Event',
  );

  await popup.reload({ waitUntil: 'networkidle' });
  await page.bringToFront();
  await popup.waitForSelector(`[data-testid="home-page"]`);

  expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();
  expect(popup.getByRole('textbox').all()).toHaveLength(1);

  expect(popup.getByLabel('Continuous payment stream')).toBeVisible();
  expect(popup.getByRole('checkbox').all()).toHaveLength(1);
});
