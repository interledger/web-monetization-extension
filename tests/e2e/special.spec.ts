import { test, expect } from './fixtures/connected';
import { setupPlayground } from './helpers/common';

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