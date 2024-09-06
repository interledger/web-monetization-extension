import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { connectWallet, openPopup } from './pages/popup';
import { authFile } from './fixtures/helpers';

test.use({ storageState: authFile });

let popup: Page;
test.beforeAll(
  async ({ persistentContext, background, browserName, extensionId }) => {
    popup = await openPopup(persistentContext, browserName, extensionId);

    const keyInfo = {
      keyId: process.env.CONNECT_KEY_ID!,
      privateKey: process.env.CONNECT_PRIVATE_KEY!,
      publicKey: process.env.CONNECT_PUBLIC_KEY!,
    };
    await connectWallet(background, keyInfo, popup, {
      walletAddressUrl: process.env.CONNECT_WALLET_ADDRESS_URL!,
      amount: '10',
      recurring: false,
    });
  },
);
test.afterAll(async () => {
  await popup.close();
});
test.beforeEach(async () => {
  await popup.reload();
});

test('should load popup', async () => {
  await popup.bringToFront();
  await expect(popup).toHaveTitle('Web Monetization Extension');
  await expect(popup.locator('#popup-container')).toBeAttached();
  await expect(popup.locator('header')).toHaveText('Web Monetization');
  await expect(popup.locator('header img')).toHaveAttribute(
    'src',
    /logo\.svg$/,
  );
});

test('shows connect form if not connected', async ({ page }) => {
  await page.goto('https://example.com');

  await expect(popup).toHaveTitle('Web Monetization Extension');
  await expect(popup.locator('#popup-container')).toBeAttached();
  await expect(popup.locator('header')).toHaveText('Web Monetization');

  await expect(popup.locator('form')).toBeVisible();
  await expect(popup.locator('form button[type="submit"]')).toBeVisible();
  await expect(popup.locator('form button[type="submit"]')).toHaveText(
    'Connect',
  );
});
