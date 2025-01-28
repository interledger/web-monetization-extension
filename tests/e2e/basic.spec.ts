import { test, expect } from './fixtures/base';
import { fillPopup } from './pages/popup';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test('should load popup', async ({ popup }) => {
  await popup.bringToFront();
  await expect(popup).toHaveTitle('Web Monetization Extension');
  await expect(popup.locator('#popup-container')).toBeAttached();
  await expect(popup.locator('header')).toHaveText('Web Monetization');
  await expect(popup.locator('header img')).toHaveAttribute(
    'src',
    /logo\.svg$/,
  );
});

test('shows connect form if not connected', async ({ page, popup }) => {
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
  test('invalid URL provided', async ({ background, popup, i18n }) => {
    const connectButton = await fillPopup(popup, i18n, {
      walletAddressUrl: 'abc',
    });

    await expect(connectButton).toBeDisabled();
    await expect(popup.locator('p.text-error')).toHaveText(
      i18n.getMessage('connectWallet_error_urlInvalidUrl'),
    );

    await expect(background).toHaveStorage({ connected: false });
  });

  test('invalid wallet address provided', async ({
    background,
    popup,
    i18n,
  }) => {
    const connectButton = await fillPopup(popup, i18n, {
      walletAddressUrl: 'https://example.com',
    });

    await expect(connectButton).toBeDisabled();
    await expect(popup.locator('p.text-error')).toContainText(
      'not a valid wallet address',
    );

    await expect(background).toHaveStorage({ connected: false });
  });
});
