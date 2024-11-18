import type { BrowserContext, Page } from '@playwright/test';
import {
  loadKeysToExtension,
  type BrowserIntl,
  type Background,
  type KeyInfo,
} from '../fixtures/helpers';
import { fillPopup, type Popup, type ConnectDetails } from '../pages/popup';
import { getWalletInformation } from '@/shared/helpers';
import { waitForWelcomePage } from './common';

export const KEYS_PAGE_URL = `https://wallet.interledger-test.dev/settings/developer-keys`;
export const LOGIN_PAGE_URL = `https://wallet.interledger-test.dev/auth/login?callbackUrl=%2Fsettings%2Fdeveloper-keys`;
export const API_URL_ORIGIN = `https://api.wallet.interledger-test.dev`;

export async function connectWallet(
  context: BrowserContext,
  background: Background,
  i18n: BrowserIntl,
  keyInfo: KeyInfo,
  popup: Popup,
  params: ConnectDetails,
) {
  await loadKeysToExtension(background, keyInfo);

  const connectButton = await fillPopup(popup, i18n, params);
  await connectButton.click();

  const continueWaitMs = await getContinueWaitTime(context, params);

  const page = await context.waitForEvent('page', (page) =>
    page.url().includes('/grant-interactions'),
  );
  await completeGrant(page, continueWaitMs);
  await page.close();
  await popup.bringToFront();
}

export async function completeGrant(page: Page, continueWaitMs: number) {
  await waitForGrantConsentPage(page);
  await acceptGrant(page, continueWaitMs);
  await waitForWelcomePage(page);
}

export async function getContinueWaitTime(
  context: BrowserContext,
  params: Pick<ConnectDetails, 'walletAddressUrl'>,
) {
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
  return continueWaitMs;
}

export async function waitForGrantConsentPage(page: Page) {
  await page.waitForURL((url) => {
    return (
      url.searchParams.has('interactId') &&
      url.searchParams.has('nonce') &&
      url.searchParams.has('clientUri')
    );
  });
}

export async function acceptGrant(page: Page, continueWaitMs: number) {
  await page.waitForTimeout(continueWaitMs);
  await page.getByRole('button', { name: 'Accept' }).click();
}

export async function revokeKey(
  page: Page,
  info: {
    accountId: string;
    walletId: string;
    keyId: string;
  },
) {
  const { accountId, walletId, keyId } = info;
  const url = `${API_URL_ORIGIN}/accounts/${accountId}/wallet-addresses/${walletId}/${keyId}/revoke-key/`;

  await page.goto(KEYS_PAGE_URL);
  await page.evaluate(async (url) => {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      mode: 'cors',
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to revoke key: ' + (await res.text()));
    }
  }, url);
}
