import { spy } from 'tinyspy';
import { test, expect } from './fixtures/connected';
import { getLastCallArg, setupPlayground } from './helpers/common';
import { setContinuousPayments } from './pages/popup';

test('iframe add/remove does not de-monetize main page', async ({
  page,
  popup,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

  await test.step('prepare', async () => {
    await expect(popup.getByTestId('not-monetized-message')).toBeVisible();

    const monetizationCallback = await setupPlayground(page, walletAddressUrl);
    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      paymentPointer: walletAddressUrl,
    });

    await expect(popup.getByTestId('home-page')).toBeVisible();

    return monetizationCallback;
  });

  await test.step('add iframe', async () => {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.id = 'cross-origin-iframe';
        iframe.src = 'https://example.com';
        document.body.prepend(iframe);
        iframe.addEventListener('load', resolve);
      });
    });

    await expect(page.locator('#cross-origin-iframe')).toBeVisible();
    await expect(popup.getByTestId('home-page')).toBeVisible();
  });

  await test.step('remove iframe', async () => {
    await page.evaluate(() => {
      const iframe = document.getElementById('cross-origin-iframe');
      iframe?.remove();
    });
    await expect(page.locator('#cross-origin-iframe')).not.toBeAttached();

    await expect(popup.getByTestId('not-monetized-message')).not.toBeVisible();
    await expect(popup.getByTestId('home-page')).toBeVisible();
  });
});

test('iframe navigate does not de-monetize main page', async ({
  page,
  popup,
}) => {
  const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

  await test.step('prepare', async () => {
    await expect(popup.getByTestId('not-monetized-message')).toBeVisible();

    const monetizationCallback = await setupPlayground(page, walletAddressUrl);

    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      paymentPointer: walletAddressUrl,
    });

    await expect(popup.getByTestId('home-page')).toBeVisible();

    return monetizationCallback;
  });

  await test.step('add iframe', async () => {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        const iframe = document.createElement('iframe');
        iframe.id = 'cross-origin-iframe';
        iframe.src = 'https://example.com';
        document.body.prepend(iframe);
        iframe.addEventListener('load', resolve, { once: true });
      });
    });
  });

  await test.step('navigate iframe', async () => {
    await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const iframe = document.getElementById('cross-origin-iframe');
        if (!iframe) {
          reject(new Error('iframe not found'));
          return;
        }
        iframe.addEventListener('load', resolve, { once: true });
        iframe.addEventListener('error', resolve, { once: true });
        iframe.setAttribute('src', 'https://example.net');
      });
    });

    await expect(popup.getByTestId('not-monetized-message')).not.toBeVisible();
    await expect(popup.getByTestId('home-page')).toBeVisible();
  });
});

test('keep site monetized on back-forward buttons', async ({ page, popup }) => {
  test.fail(
    true,
    'https://github.com/interledger/web-monetization-extension/issues/841',
  );

  await setContinuousPayments(popup, false); // don't need payments to see monetized status
  await popup.reload();

  const expect = (await import('./fixtures/connected')).expect.configure({
    soft: true,
  });

  // to check if page was loaded with bf-cache or not (persisted = true means from bf-cache)
  const pageShowCallback = spy<[[persisted: boolean, url: string]], void>();
  await page.exposeFunction('pageShowCallback', pageShowCallback);
  await page.addInitScript({
    content: `window.addEventListener('pageshow', ev => {
      pageShowCallback([ev.persisted, window.location.href])
    });`,
  });

  const homePage = popup.getByTestId('home-page');
  const notMonetizedMsg = popup.getByTestId('not-monetized-message');

  // TODO: use URLs from a local server with more-controlled fixtures
  const URL_A = 'https://sidvishnoi.com/test/wm/';
  const URL_B = 'https://example.com/';

  await page.goto(URL_A);
  await expect(pageShowCallback).toHaveBeenCalledTimes(1);
  expect(getLastCallArg(pageShowCallback)).toEqual([false, URL_A]);
  await expect(homePage).toBeVisible();
  await expect(notMonetizedMsg).not.toBeVisible();

  await page.goto(URL_B);
  await expect(pageShowCallback).toHaveBeenCalledTimes(2);
  expect(getLastCallArg(pageShowCallback)).toEqual([false, URL_B]);
  await expect(homePage).not.toBeVisible();
  await expect(notMonetizedMsg).toBeVisible();

  await page.evaluate(() => history.back());
  await expect(pageShowCallback).toHaveBeenCalledTimes(3);
  expect(getLastCallArg(pageShowCallback)).toEqual([true, URL_A]);
  await expect(homePage).toBeVisible();
  await expect(notMonetizedMsg).not.toBeVisible();

  await page.evaluate(() => history.forward());
  await expect(pageShowCallback).toHaveBeenCalledTimes(4);
  expect(getLastCallArg(pageShowCallback)).toEqual([true, URL_B]);
  await expect(homePage).not.toBeVisible();
  await expect(notMonetizedMsg).toBeVisible();
});
