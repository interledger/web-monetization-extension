import type { BrowserContext } from '@playwright/test';
import {
  loadKeysToExtension,
  type Background,
  type KeyInfo,
} from '../fixtures/helpers';

type Popup = Awaited<ReturnType<typeof openPopup>>;

export async function openPopup(
  context: BrowserContext,
  browserName: string,
  extensionId: string,
) {
  const popup = await context.newPage();
  const url = getPopupUrl(browserName, extensionId);
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
  background: Background,
  keyInfo: KeyInfo,
  popup: Popup,
  params: { walletAddressUrl: string; amount: string; recurring: boolean },
) {
  await loadKeysToExtension(background, keyInfo);

  await popup
    .getByLabel('Wallet address or payment pointer')
    .fill(params.walletAddressUrl);
  await popup.getByLabel('Amount', { exact: true }).fill(params.amount);
  await popup.getByLabel('Renew amount monthly').setChecked(params.recurring);
  await popup.getByRole('button', { name: 'Connect' }).click();

  // TODO: "Accept" the consent.
  // TODO: FIXME: rafiki.money not restoring `storageState`
  await popup.waitForURL(params.walletAddressUrl);
}
