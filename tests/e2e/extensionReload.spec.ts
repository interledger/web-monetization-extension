// cSpell:ignore serviceworker
import type { BrowserContext } from '@playwright/test';
import { test, expect } from './fixtures/connected';
import { setupPlayground } from './helpers/common';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

/**
 * `chrome.runtime.reload()` only brings an unpacked extension back with
 * developer mode on; otherwise Chrome leaves it disabled.
 */
async function enableDeveloperMode(context: BrowserContext) {
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions/');
  const devMode = extensionsPage.locator('extensions-toolbar #devMode');
  // The toggle has a `checked` attribute while it's on, whether it's the older
  // (aria-pressed) or the newer (role=switch, aria-checked) version.
  if ((await devMode.getAttribute('checked')) === null) {
    await devMode.click();
  }
  await expect(devMode).toHaveAttribute('checked');
  await extensionsPage.close();
}

test('keeps monetizing an open tab after the extension is reloaded', async ({
  context,
  background,
  popup,
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Firefox and Safari stop the content scripts of a reloaded extension themselves',
  );

  // Errors from every execution context, including the content script's.
  const cdp = await context.newCDPSession(page);
  const errors: string[] = [];
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    errors.push(
      exceptionDetails.exception?.description ?? exceptionDetails.text,
    );
  });
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    if (type === 'error') {
      errors.push(args.map((a) => a.value ?? a.description).join(' '));
    }
  });
  await cdp.send('Runtime.enable');

  const monetizationCallback = await setupPlayground(page, walletAddressUrl);
  await expect(monetizationCallback).toHaveBeenCalledTimes(1);

  await enableDeveloperMode(context);
  await page.bringToFront();

  // Reload the extension, as an update does. The content script in the open
  // tab loses its connection to the extension.
  const popupUrl = popup.url().split('#', 2)[0];
  const newBackground = context.waitForEvent('serviceworker', {
    predicate: (worker) => worker !== background,
  });
  await background
    .evaluate(() => chrome.runtime.reload())
    .catch(() => {
      // the service worker goes away while evaluating
    });
  await newBackground;

  // The content script injected after the reload picks up the existing link,
  // so the page keeps being monetized, and the previous one doesn't throw.
  await expect(monetizationCallback).toHaveBeenCalledTimes(2, {
    timeout: 15_000,
  });
  await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
    walletAddress: walletAddressUrl,
  });
  expect(
    errors.filter((e) => /Extension context invalidated|sendMessage/.test(e)),
  ).toEqual([]);

  // The reload replaced the popup's page; open it again for the teardown.
  await popup.goto(popupUrl);
});
