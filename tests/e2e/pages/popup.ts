import type { BrowserContext } from '@playwright/test';
import type { BrowserInfo } from '../fixtures/helpers';

export type Popup = Awaited<ReturnType<typeof openPopup>>;

export { connectWallet } from '../helpers/testWallet';

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

export async function fillPopup(popup: Popup, params: Partial<ConnectDetails>) {
  const fields = getPopupFields(popup);
  if (typeof params.walletAddressUrl !== 'undefined') {
    await fields.walletAddressUrl.fill(params.walletAddressUrl);
    await fields.walletAddressUrl.blur();
  }
  if (typeof params.amount !== 'undefined') {
    await fields.amount.fill(params.amount);
    await fields.amount.blur();
  }
  if (typeof params.recurring !== 'undefined') {
    await fields.recurring.setChecked(params.recurring, { force: true });
    await fields.recurring.blur();
  }

  return fields.connectButton;
}

export function getPopupFields(popup: Popup) {
  return {
    walletAddressUrl: popup.getByLabel('Enter wallet address/payment pointer'),
    amount: popup.getByLabel('Amount', { exact: true }),
    recurring: popup.getByLabel('Renew monthly'),
    connectButton: popup.locator('button').getByText('Connect'),
  };
}
