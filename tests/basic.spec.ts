import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import { fillPopup, getMessage, openPopup } from './pages/popup';

let popup: Page;
test.beforeAll(async ({ persistentContext, browserName, extensionId }) => {
  popup = await openPopup(persistentContext, browserName, extensionId);
});
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

test.describe('should fail to connect if:', () => {
  test('invalid URL provided', async ({ background }) => {
    const connectButton = await fillPopup(popup, {
      walletAddressUrl: 'abc',
      amount: '10',
      recurring: false,
    });
    await connectButton.click();
    await expect(popup.locator('p.text-error')).toHaveText('Failed to fetch');
    expect(
      await background.evaluate(() => {
        return chrome.storage.local.get(['connected']);
      }),
    ).toEqual({ connected: false });
  });

  test('invalid wallet address provided', async ({ background }) => {
    const connectButton = await fillPopup(popup, {
      walletAddressUrl: 'https://example.com',
      amount: '10',
      recurring: false,
    });
    await expect(popup.locator('p.text-error')).toContainText(
      'Invalid wallet address.',
    );

    await connectButton.click();
    await expect(popup.locator('p.text-error')).toContainText(
      'Unexpected token',
    );
    expect(
      await background.evaluate(() => {
        return chrome.storage.local.get(['connected']);
      }),
    ).toEqual({ connected: false });
  });

  test('public key not added', async () => {
    const { CONNECT_WALLET_ADDRESS_URL } = process.env;
    expect(CONNECT_WALLET_ADDRESS_URL).toBeDefined();

    const connectButton = await fillPopup(popup, {
      walletAddressUrl: CONNECT_WALLET_ADDRESS_URL!,
      amount: '10',
      recurring: false,
    });
    await connectButton.click();

    await expect(popup.locator('p.text-error')).toHaveText(
      getMessage('connectWallet_error_invalidClient'),
    );
  });
});
