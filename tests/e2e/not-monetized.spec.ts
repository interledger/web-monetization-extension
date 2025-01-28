import type { Locator } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { test, expect } from './fixtures/base';
import { connectWallet, disconnectWallet } from './pages/popup';
import { setupPlayground } from './helpers/common';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

test.describe('not-monetized status', () => {
  test.beforeAll(async ({ background, popup, persistentContext, i18n }) => {
    await connectWallet(persistentContext, background, i18n, null, popup, {
      walletAddressUrl,
      amount: '10',
      recurring: false,
    });
  });

  test.afterAll(async ({ popup }) => {
    await disconnectWallet(popup);
  });

  test.beforeEach(async ({ popup, page }) => {
    await popup.reload();
    await page.bringToFront();
  });

  test('shows not monetized on empty tabs', async ({
    popup,
    i18n,
    persistentContext: context,
  }) => {
    const warning = popup.getByTestId('not-monetized-message');
    const msg = i18n.getMessage('notMonetized_text_newTab');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(msg);

    await context.newPage().then((page) => page.bringToFront());
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(msg);
  });

  test('shows not monetized on internal pages', async ({
    page,
    popup,
    i18n,
    channel,
  }) => {
    const url = channel === 'msedge' ? 'edge://settings' : 'chrome://settings';
    await page.goto(url);

    const warning = popup.getByTestId('not-monetized-message');
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(
      i18n.getMessage('notMonetized_text_internalPage'),
    );
  });

  test.describe('shows not monetized on non-https pages', () => {
    let warning: Locator;
    let msg: string;

    test.beforeAll(async ({ popup, i18n }) => {
      warning = popup.getByTestId('not-monetized-message');
      msg = i18n.getMessage('notMonetized_text_unsupportedScheme');
    });

    test.beforeEach(async ({ popup, page }) => {
      await popup.reload();
      await page.bringToFront();
    });

    test('http:// URLs', async ({ page }) => {
      await page.goto('http://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg);
    });

    test('navigating from https:// to http://', async ({ page, i18n }) => {
      await page.goto('https://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(
        i18n.getMessage('notMonetized_text_noLinks'),
      );

      await page.goto('http://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg);
    });

    test('file:// URLs', async ({ page }) => {
      await page.goto(pathToFileURL('.').href);
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg);
    });

    test('extension pages', async ({ page, background }) => {
      const popupUrl = await background.evaluate(() =>
        chrome.action.getPopup({}),
      );
      await page.goto(popupUrl);
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg);
    });
  });

  test.describe('shows not monetized on non-monetized pages', () => {
    let warning: Locator;
    let msg: string;

    test.beforeAll(async ({ popup, i18n }) => {
      warning = popup.getByTestId('not-monetized-message');
      msg = i18n.getMessage('notMonetized_text_noLinks');
    });

    test.beforeEach(async ({ page, popup }) => {
      await popup.reload();
      await page.bringToFront();
    });

    test('no link tags', async ({ page }) => {
      await page.goto('https://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg);
    });

    test('no enabled link tags', async ({ page }) => {
      await page.goto('https://example.com');
      await page.evaluate((walletAddressUrl) => {
        const link = document.createElement('link');
        link.rel = 'monetization';
        link.disabled = true;
        link.href = walletAddressUrl;
        document.head.appendChild(link);
      }, walletAddressUrl);
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg);
    });

    test('navigating from monetized to non-monetized', async ({ page }) => {
      await setupPlayground(page, walletAddressUrl);
      await expect(warning).not.toBeVisible();

      await page.goto('https://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg);
    });
  });
});
