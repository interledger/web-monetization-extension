import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/connected';
import { playgroundUrl, setupPlayground } from './helpers/common';
import { makeOneTimePayment, setContinuousPayments } from './pages/popup';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

test.beforeAll(async ({ popup, background }) => {
  await setContinuousPayments(popup, false);
  await expect(background).toHaveStorage({ continuousPaymentsEnabled: false });
});

function createIframe([src, attrs = {}]: [
  src: string,
  attrs?: Record<string, string>,
]) {
  const iframe = document.createElement('iframe');
  for (const [key, value] of Object.entries(attrs)) {
    iframe.setAttribute(key, value);
  }
  iframe.src = src;
  document.body.append(iframe);
  return new Promise<void>((resolve) =>
    iframe.addEventListener('load', () => resolve(), { once: true }),
  );
}

async function setupIframe(
  page: Page,
  src: string,
  attrs: Record<string, string>,
) {
  await page.evaluate(() => {
    window.addEventListener('message', (ev) => {
      if (typeof ev.data === 'object' && ev.data.message === 'monetization') {
        // @ts-expect-error defined globally
        monetizationCallback(ev.data.payload);
      }
    });
  });

  await page.evaluate(createIframe, [src, attrs]);
  const iframe = attrs.name ? page.frame(attrs.name) : page.frame({ url: src });
  if (!iframe) {
    throw new Error('iframe not found');
  }
  await iframe.addScriptTag({
    content: `window.addEventListener('monetization', (ev) => {
      window.parent.postMessage({ message: 'monetization', payload: { amountSent: {amount: '0.5'} } }, '*');
    });`,
  });
}

test.describe('monetizes iframe when allowed', () => {
  test('allow attribute set to "monetization"', async ({ page, popup }) => {
    const monetizationCallback = await setupPlayground(page, walletAddressUrl);
    // TODO: should add different wallet here
    await setupIframe(page, playgroundUrl(walletAddressUrl), {
      name: 'iframe',
      allow: 'monetization',
    });

    await expect(monetizationCallback).toHaveBeenCalledTimes(0);

    await makeOneTimePayment(popup, '0.5');
    await page.waitForTimeout(2000);
    console.log(monetizationCallback.calls);
    await expect(monetizationCallback).toHaveBeenCalledTimes(2);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      paymentPointer: walletAddressUrl,
    });
    expect(monetizationCallback).toHaveAmountCloseTo(0.25); // split into two
  });
});

test.describe('does not monetize iframe when not allowed', () => {
  test('allow attribute not specified', async ({ page, popup }) => {
    const monetizationCallback = await setupPlayground(page, walletAddressUrl);
    await page.evaluate(createIframe, [
      playgroundUrl(walletAddressUrl), // TODO: should add different wallet here
      { id: 'iframe' },
    ]);
    await expect(page.locator('#iframe')).toHaveAttribute('id', 'iframe');
    await expect(monetizationCallback).toHaveBeenCalledTimes(0);

    await makeOneTimePayment(popup, '0.5');
    await page.waitForTimeout(2000);
    await expect(monetizationCallback).toHaveBeenCalledTimes(1);
    await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
      paymentPointer: walletAddressUrl,
    });
    expect(monetizationCallback).toHaveAmountCloseTo(0.5); // not split into two
  });
});
