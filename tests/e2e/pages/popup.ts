// cSpell:ignore requestfinished
import type { BrowserContext } from '@playwright/test';
import {
  loadKeysToExtension,
  type Background,
  type BrowserInfo,
  type KeyInfo,
} from '../fixtures/helpers';
import { getWalletInformation } from '@/shared/helpers';

export type Popup = Awaited<ReturnType<typeof openPopup>>;

export async function openPopup(
  context: BrowserContext,
  { browserName, channel }: BrowserInfo,
  extensionId: string,
) {
  const url = getPopupUrl({ browserName, channel }, extensionId);
  const page = await context.newPage();
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate(() => {
    return window.open('', '', 'popup=true,width=448,height=600');
  });
  const popup = await popupPromise;
  await page.close();
  await popup.goto(url); // window.open doesn't allow internal browser pages
  try {
    await popup.waitForSelector('#main', { timeout: 300 });
  } catch {
    await popup.reload({ waitUntil: 'networkidle' });
    await popup.waitForSelector('#main', { timeout: 500 });
  }
  return popup;
}

function getPopupUrl(
  { browserName, channel }: BrowserInfo,
  extensionId: string,
) {
  let url: string;
  if (browserName === 'chromium') {
    if (channel === 'edge') {
      url = `extension://${extensionId}/popup/index.html`;
    } else {
      url = `chrome-extension://${extensionId}/popup/index.html`;
    }
  } else if (browserName === 'firefox') {
    url = `moz-extension://${extensionId}/popup/index.html`;
  } else {
    throw new Error('Unsupported browser: ' + browserName);
  }
  return url;
}

export async function connectWallet(
  context: BrowserContext,
  background: Background,
  keyInfo: KeyInfo,
  popup: Popup,
  params: ConnectDetails,
) {
  await loadKeysToExtension(background, keyInfo);

  const connectButton = await fillPopup(popup, params);
  await connectButton.click();

  const continueWaitMs = await (async () => {
    const defaultWaitMs = 1001;
    if (process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS !== '1') {
      return Promise.resolve(defaultWaitMs);
    }
    const walletInfo = await getWalletInformation(params.walletAddressUrl);
    return await new Promise<number>((resolve) => {
      const authServer = new URL(walletInfo.authServer).href;
      context.on('requestfinished', async function intercept(req) {
        if (!req.serviceWorker()) return;
        if (new URL(req.url()).href !== authServer) return;

        const res = await req.response();
        const json = await res?.json();
        context.off('requestfinished', intercept);
        if (typeof json?.continue?.wait !== 'number') {
          return resolve(defaultWaitMs);
        }
        return resolve(json.continue.wait * 1000);
      });
    });
  })();

  const page = await context.waitForEvent('page', (page) =>
    page.url().includes('/grant-interactions'),
  );
  await page.waitForURL((url) => {
    return (
      url.searchParams.has('interactId') &&
      url.searchParams.has('nonce') &&
      url.searchParams.has('clientUri')
    );
  });
  await page.waitForTimeout(continueWaitMs);
  await page.getByRole('button', { name: 'Accept' }).click();

  const CONFIG_OPEN_PAYMENTS_REDIRECT_URL = `https://webmonetization.org/welcome`;
  await page.waitForURL(
    (url) =>
      url.href.startsWith(CONFIG_OPEN_PAYMENTS_REDIRECT_URL) &&
      url.searchParams.get('result') === 'grant_success',
  );
  await page.close();
  await popup.bringToFront();
}

export async function disconnectWallet(popup: Popup) {
  await popup.locator(`[href="/settings"]`).click();
  await popup.locator('button').getByText('Disconnect').click();
  await popup.getByTestId('connect-wallet-form').waitFor({ state: 'visible' });
}

export type ConnectDetails = {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
};

export async function fillPopup(popup: Popup, params: ConnectDetails) {
  await popup
    .getByLabel('Wallet address or payment pointer')
    .fill(params.walletAddressUrl);
  await popup.getByLabel('Amount', { exact: true }).fill(params.amount);
  await popup
    .getByLabel('Renew amount monthly')
    .setChecked(params.recurring, { force: true });

  return popup.getByRole('button', { name: 'Connect' });
}
