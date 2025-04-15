import type { BrowserContext, Locator } from '@playwright/test';
import type { BrowserIntl, Background } from '../fixtures/helpers';

export type Popup = Awaited<ReturnType<typeof openPopup>>;

export { connectWallet } from '../helpers/testWallet';

export async function openPopup(
  context: BrowserContext,
  background: Background,
) {
  const url = await background.evaluate(() => chrome.action.getPopup({}));
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

  // prevent popup from closing via `window.close()`
  popup.exposeFunction('close', () => {});

  return popup;
}

export async function disconnectWallet(popup: Popup) {
  await goToHome(popup);
  await locators.settingsLink(popup).click({ timeout: 1000 });
  await popup.getByRole('tab', { name: 'Wallet' }).click();

  await popup
    .getByRole('button', { name: 'Disconnect' })
    .click({ timeout: 2000 });
  await popup
    .getByTestId('connect-wallet-form')
    .waitFor({ state: 'visible', timeout: 2000 });
}

export type ConnectDetails = {
  walletAddressUrl: string;
  amount: string;
  recurring: boolean;
};

export async function fillPopup(
  popup: Popup,
  i18n: BrowserIntl,
  params: Partial<ConnectDetails>,
) {
  const timeout = 1000;
  const fields = getPopupFields(popup, i18n);
  if (typeof params.walletAddressUrl !== 'undefined') {
    await fields.walletAddressUrl.fill(params.walletAddressUrl, { timeout });
    await fields.walletAddressUrl.blur({ timeout });
  }
  if (typeof params.amount !== 'undefined') {
    await fields.amount.fill(params.amount, { timeout });
    await fields.amount.blur({ timeout });
  }
  if (typeof params.recurring !== 'undefined') {
    await fields.recurring.setChecked(params.recurring, {
      force: true,
      timeout,
    });
    await fields.recurring.blur({ timeout });
  }

  return fields.connectButton;
}

export function getPopupFields(popup: Popup, i18n: BrowserIntl) {
  return {
    walletAddressUrl: popup.getByLabel(
      i18n.getMessage('connectWallet_label_walletAddress'),
    ),
    amount: popup.getByLabel(i18n.getMessage('connectWallet_label_amount'), {
      exact: true,
    }),
    recurring: popup.getByLabel(
      i18n.getMessage('connectWallet_label_recurring'),
    ),
    connectButton: popup
      .locator('button')
      .getByText(i18n.getMessage('connectWallet_action_connect')),
  };
}

export async function setContinuousPayments(popup: Popup, enabled: boolean) {
  await goToHome(popup);
  await locators.settingsLink(popup).click({ timeout: 1000 });
  await popup.getByRole('tab', { name: 'Rate' }).click();

  await popup
    .getByTestId('continuous-payments-toggle')
    .setChecked(enabled, { force: true });
}

/** Whatever screen we're on in popup right now, take us to Home screen */
export async function goToHome(popup: Popup) {
  await popup.evaluate(() => {
    location.hash = '';
  });
  await popup.reload();
  await popup.waitForSelector(
    '[data-testid="home-page"], [data-testid="not-monetized-message"], [data-user-action="required"]',
    { timeout: 1000 },
  );
}

export async function sendOneTimePayment(
  popup: Popup,
  amount: string | number,
  waitForComplete = false,
) {
  await popup.getByRole('textbox').fill(amount.toString());
  const sendButton = popup.getByRole('button', { name: 'Send now' });
  await sendButton.click();
  if (waitForComplete) {
    await popup.waitForSelector('button[data-progress="false"]', {
      timeout: 10_000,
    });
  } else {
    await popup.waitForTimeout(1_000); // at least let the payment be initiated
  }
  return sendButton;
}

export const locators = {
  settingsLink: (popup) => popup.getByRole('link', { name: 'Settings' }),
  backLink: (popup) => popup.getByRole('link', { name: 'Back' }),
} satisfies { [key: string]: (popup: Popup) => Locator };
