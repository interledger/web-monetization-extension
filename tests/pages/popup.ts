import path from 'node:path';
import { readFileSync } from 'node:fs';
import type { BrowserContext } from '@playwright/test';
import {
  loadKeysToExtension,
  SRC_DIR,
  type Background,
  type KeyInfo,
} from '../fixtures/helpers';

type Popup = Awaited<ReturnType<typeof openPopup>>;

export async function openPopup(
  context: BrowserContext,
  browserName: string,
  extensionId: string,
) {
  const url = getPopupUrl(browserName, extensionId);
  const page = await context.newPage();
  const popupPromise = page.waitForEvent('popup');
  await page.evaluate((popupUrl) => {
    return window.open(popupUrl, '', 'popup=true,width=448,height=600');
  }, url);
  const popup = await popupPromise;
  await page.close();
  await popup.goto(url);
  return popup;
}

function getPopupUrl(browserName: string, extensionId: string) {
  let url: string;
  if (browserName === 'chromium') {
    url = `chrome-extension://${extensionId}/popup/index.html`;
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

type TranslationKeys =
  keyof typeof import('../../src/_locales/en/messages.json');

type TranslationData = Record<
  TranslationKeys,
  { message: string; placeholders?: Record<string, { content: string }> }
>;

const MESSAGES = {
  _cache: new Map<string, TranslationData>(),
  get(lang: string) {
    const cached = this._cache.get(lang);
    if (cached) return cached;

    const filePath = path.join(SRC_DIR, '_locales', lang, 'messages.json');
    const data = JSON.parse(readFileSync(filePath, 'utf8')) as TranslationData;
    this._cache.set(lang, data);
    return data;
  },
};

export function getMessage(
  key: TranslationKeys,
  substitutions?: string | string[],
  language = 'en',
) {
  const msg = MESSAGES.get(language)[key] || MESSAGES.get('en')[key];
  if (typeof msg === 'undefined') {
    throw new Error(`Message not found: ${key}`);
  }

  let result = msg.message;
  if (!msg.placeholders) return result;

  if (!substitutions) {
    throw new Error('Missing substitutions');
  }

  if (typeof substitutions === 'string') {
    substitutions = [substitutions];
  }

  for (const [key, { content }] of Object.entries(msg.placeholders)) {
    const idx = Number(content.replace('$', ''));
    result = result.replaceAll(`$${key.toUpperCase()}$`, substitutions[idx]);
  }
  return result;
}
