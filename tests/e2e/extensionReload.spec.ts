// cSpell:ignore serviceworker
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

/** Adds a monetization link and resolves with the event the extension fires on it. */
function addMonetizationLink(page: Page, href: string) {
  return page.evaluate(
    (href) =>
      new Promise<string>((resolve) => {
        const link = document.createElement('link');
        link.rel = 'monetization';
        link.href = href;
        link.addEventListener('load', () => resolve('load'), { once: true });
        link.addEventListener('error', () => resolve('error'), { once: true });
        document.head.append(link);
      }),
    href,
  );
}

test('keeps monetizing an open tab after the extension is reloaded', async ({
  context,
  background,
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Firefox and Safari stop the content scripts of a reloaded extension themselves',
  );
  if (!walletAddressUrl) throw new Error('Missing TEST_WALLET_ADDRESS_URL');

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

  await page.goto('https://example.com');
  await expect
    .poll(() => addMonetizationLink(page, walletAddressUrl), {
      timeout: 10_000,
    })
    .toBe('load');

  // chrome.runtime.reload() only brings an unpacked extension back with
  // developer mode on; otherwise Chrome leaves it disabled.
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions/');
  const devMode = extensionsPage.locator('extensions-toolbar #devMode');
  await devMode.click();
  await expect(devMode).toHaveAttribute('aria-pressed', 'true');
  await extensionsPage.close();
  await page.bringToFront();

  // Reload the extension, as an update does. Its content script in the open
  // tab loses its connection to the extension.
  const newBackground = context.waitForEvent('serviceworker', {
    predicate: (worker) => worker !== background,
  });
  await background
    .evaluate(() => chrome.runtime.reload())
    .catch(() => {
      // the service worker goes away while evaluating
    });
  await newBackground;

  // The content script injected after the reload takes over: links are still
  // validated, and the previous one doesn't throw.
  await expect
    .poll(() => addMonetizationLink(page, walletAddressUrl), {
      timeout: 10_000,
    })
    .toBe('load');
  expect(
    errors.filter((e) => /Extension context invalidated|sendMessage/.test(e)),
  ).toEqual([]);
});
