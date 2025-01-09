import { spy } from 'tinyspy';
import { test, expect } from './fixtures/connected';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test('should monetize site with single wallet address', async ({
  page,
  popup,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
  const playgroundUrl = 'https://webmonetization.org/play/';

  await page.goto(playgroundUrl);

  const monetizationCallback = spy<[Event], void>();
  await page.exposeFunction('monetizationCallback', monetizationCallback);
  await page.evaluate(() => {
    window.addEventListener('monetization', monetizationCallback);
  });

  await page
    .getByLabel('Wallet address/Payment pointer')
    .fill(walletAddressUrl);
  await page.getByRole('button', { name: 'Add monetization link' }).click();

  await expect(page.locator('link[rel=monetization]')).toHaveAttribute(
    'href',
    walletAddressUrl,
  );

  await page.waitForSelector('#link-events .log-header');
  await page.waitForSelector('#link-events ul.events li');
  await expect(page.locator('#link-events ul.events li').last()).toContainText(
    'Load Event',
  );

  await expect(monetizationCallback).toHaveBeenCalledTimes(1);
  await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
    paymentPointer: walletAddressUrl,
    amountSent: {
      currency: expect.stringMatching(/^[A-Z]{3}$/),
      value: expect.stringMatching(/^0\.\d+$/),
    },
    incomingPayment: expect.stringContaining(new URL(walletAddressUrl).origin),
  });

  await popup.reload({ waitUntil: 'networkidle' });
  await page.bringToFront();
  await popup.waitForSelector(`[data-testid="home-page"]`);

  await expect(popup.getByRole('button', { name: 'Send now' })).toBeVisible();
  expect(await popup.getByRole('textbox').all()).toHaveLength(1);
});
