import type { BrowserContext, Page } from '@playwright/test';
import {
  loadKeysToExtension,
  type BrowserIntl,
  type Background,
  type KeyInfo,
} from '../fixtures/helpers';
import { fillPopup, type Popup, type ConnectDetails } from '../pages/popup';
import { getContinueWaitTime, waitForPage, waitForWelcomePage } from './common';
import { revokeKey as revokeKeyApi } from '@/content/keyAutoAdd/lib/helpers/testWallet';

export const TEST_WALLET_ORIGIN = 'https://wallet.interledger-test.dev';
export const API_URL_ORIGIN = 'https://api.wallet.interledger-test.dev';
export const KEYS_PAGE_URL = `${TEST_WALLET_ORIGIN}/settings/developer-keys`;
export const LOGIN_PAGE_URL = `${TEST_WALLET_ORIGIN}/auth/login?callbackUrl=${encodeURIComponent('/settings/developer-keys')}`;

export const DEFAULT_CONTINUE_WAIT_MS = 1000;

export const DEFAULT_KEY_INFO: KeyInfo = {
  keyId: process.env.TEST_WALLET_KEY_ID,
  privateKey: process.env.TEST_WALLET_PRIVATE_KEY,
  publicKey: process.env.TEST_WALLET_PUBLIC_KEY,
};

/**
 * @param keyInfo required if not using default {@linkcode params['walletAddressUrl']}
 */
export async function connectWallet(
  context: BrowserContext,
  background: Background,
  popup: Popup,
  i18n: BrowserIntl,
  params: ConnectDetails,
  keyInfo: KeyInfo = DEFAULT_KEY_INFO,
) {
  await loadKeysToExtension(background, keyInfo);

  const connectButton = await fillPopup(popup, i18n, params);
  void connectButton.click();

  const continueWaitMs = await getContinueWaitTime(
    context,
    params,
    DEFAULT_CONTINUE_WAIT_MS,
  );

  const page = await waitForPage(context, (url) => {
    return url.includes('/grant-interactions');
  });
  await completeGrant(page, continueWaitMs);
  await page.close();
  await popup.bringToFront();
}

export async function completeGrant(page: Page, continueWaitMs: number) {
  await waitForGrantConsentPage(page);
  await acceptGrant(page, continueWaitMs);
  await waitForWelcomePage(page);
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
  apiOrigin = API_URL_ORIGIN,
  keysPageUrl = KEYS_PAGE_URL,
) {
  await page.goto(keysPageUrl);
  await page.evaluate(revokeKeyApi, { apiOrigin, ...info });
}
