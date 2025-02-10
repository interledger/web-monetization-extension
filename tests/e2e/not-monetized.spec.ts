import { pathToFileURL } from 'node:url';
import { test, expect } from './fixtures/connected';
import { setupPlayground } from './helpers/common';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

// We make extensive use of test.step in this test to reuse the same browser
// instance, as connecting wallet each time for small tests is expensive.
test('shows not-monetized status', async ({
  popup,
  i18n,
  channel,
  background,
  context,
}) => {
  const warning = popup.getByTestId('not-monetized-message');
  const msg = {
    newTab: i18n.getMessage('notMonetized_text_newTab'),
    internalPage: i18n.getMessage('notMonetized_text_internalPage'),
    unsupportedScheme: i18n.getMessage('notMonetized_text_unsupportedScheme'),
    noLinks: i18n.getMessage('notMonetized_text_noLinks'),
  };

  const newPage = async () => {
    const page = await context.newPage();
    await popup.reload();
    await page.bringToFront();
    return {
      goto: page.goto.bind(page), // so we don't have to call `page.page.goto()` every time
      page: page,
      [Symbol.asyncDispose]: async () => {
        await page.close();
      },
    };
  };

  await test.step('shows not monetized on empty tabs', async () => {
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(msg.newTab);

    await using _page = await newPage();
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(msg.newTab);
  });

  await test.step('shows not monetized on internal pages', async () => {
    await using page = await newPage();
    const url = channel === 'msedge' ? 'edge://settings' : 'chrome://settings';
    await page.goto(url);

    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(msg.internalPage);
  });

  await test.step('shows not monetized on non-https pages', async () => {
    await test.step('http:// URLs', async () => {
      await using page = await newPage();
      await page.goto('http://httpforever.com/');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.unsupportedScheme);
    });

    await test.step('navigating from https:// to http://', async () => {
      await using page = await newPage();
      await page.goto('https://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.noLinks);

      await page.goto('http://httpforever.com/');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.unsupportedScheme);
    });

    await test.step('file:// URLs', async () => {
      await using page = await newPage();
      await page.goto(pathToFileURL('.').href);
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.unsupportedScheme);
    });

    await test.step('extension pages', async () => {
      await using page = await newPage();
      const popupUrl = await background.evaluate(() =>
        chrome.action.getPopup({}),
      );
      await page.goto(popupUrl);
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.unsupportedScheme);
    });
  });

  await test.step('shows not monetized on non-monetized pages', async () => {
    await test.step('no link tags', async () => {
      await using page = await newPage();
      await page.goto('https://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.noLinks);
    });

    await test.step('no enabled link tags', async () => {
      await using page = await newPage();
      await page.goto('https://example.com');
      await page.page.evaluate((walletAddressUrl) => {
        const link = document.createElement('link');
        link.rel = 'monetization';
        link.disabled = true;
        link.href = walletAddressUrl;
        document.head.appendChild(link);
      }, walletAddressUrl);
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.noLinks);
    });

    await test.step('navigating from monetized to non-monetized', async () => {
      await using page = await newPage();
      await setupPlayground(page.page, walletAddressUrl);
      await expect(warning).not.toBeVisible();

      await page.goto('https://example.com');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveText(msg.noLinks);
    });
  });
});
