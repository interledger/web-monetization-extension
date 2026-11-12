/// <reference types="chrome"/>
import type { Storage, StorageKey } from '../../../src/shared/types';

const TEST_WALLET_ORIGIN = 'https://wallet.interledger-test.dev';

export const DEFAULT_BUDGET = 10;

// Needs an extension page (e.g. the popup) as the current window.
export const t = (key: string) =>
  browser.execute((key: string) => chrome.i18n.getMessage(key), key);

export const getStorage = (keys: StorageKey[]) =>
  browser.execute(
    (keys: StorageKey[]) =>
      chrome.storage.local.get(keys) as Promise<Partial<Storage>>,
    keys,
  );

export const setStorage = (data: Partial<Storage>) =>
  browser.execute(
    (data: Partial<Storage>) => chrome.storage.local.set(data),
    data,
  );

export const click = async (selector: string) => {
  const el = $(selector);
  await el.scrollIntoView({ block: 'center' });
  // Messages under the popup inputs can briefly cover the button.
  await el.waitForClickable();
  await el.click();
};

export const playgroundUrl = (walletAddressUrl: string) => {
  const url = new URL('https://webmonetization.org/play/');
  url.searchParams.append('wa', walletAddressUrl);
  return url.href;
};

export const switchToUrl = (
  match: (url: string) => boolean,
  timeout = 20_000,
) =>
  browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        // The extension closes some of its own tabs while connecting.
        const url = await browser
          .switchToWindow(handle)
          .then(() => browser.getUrl())
          .catch(() => '');
        if (match(url)) return true;
      }
      return false;
    },
    { timeout, interval: 500 },
  );

// Not `closeWindow()`: it makes WebdriverIO switch to another window in the
// background, which can land after the next switch and close the wrong window.
export const closeWindows = async (handles: string[], current: string) => {
  await browser.switchToWindow(current);
  const open = await browser.getWindowHandles();
  for (const context of handles.filter((h) => open.includes(h))) {
    await browser.browsingContextClose({ context });
  }
};

// A popup-type window, so the extension keeps treating the main window as the
// current one.
export const openPopup = async (main: string) => {
  await browser.switchToWindow(main);
  const before = await browser.getWindowHandles();
  await browser.execute(() => {
    window.open('', '', 'popup=true,width=448,height=900');
  });
  let handle = '';
  await browser.waitUntil(async () => {
    const handles = await browser.getWindowHandles();
    handle = handles.find((h) => !before.includes(h)) ?? '';
    return !!handle;
  });
  await browser.switchToWindow(handle);
  await browser.url(`${process.env.EXTENSION_BASE_URL}/popup/index.html`);
  // The popup closes itself after connecting.
  await browser.execute(() => {
    window.close = () => {};
  });
  return handle;
};

// Accept data sharing consent on the post-install page so the popup is usable.
export const acceptConsent = async (main: string) => {
  const base = process.env.EXTENSION_BASE_URL;
  await switchToUrl((url) => url.startsWith(`${base}/pages/app/`), 5000).catch(
    async () => {
      // window.open() can't open extension pages in Chrome.
      const { handle } = await browser.createWindow('tab');
      await browser.switchToWindow(handle);
      await browser.url(`${base}/pages/app/index.html#/post-install`);
    },
  );
  await setStorage({
    uid: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    consentTelemetry: false,
  });
  await $('#consent-form').waitForDisplayed();
  await click('#consent-form input[type="checkbox"]');
  const telemetry = await $('#consent-field-telemetry');
  if (await telemetry.isSelected()) {
    await browser.execute((el) => el.click(), telemetry);
  }
  await expect(telemetry).not.toBeSelected();
  await click('#consent-form button[type="submit"]');
  await browser.switchToWindow(main);
};

// The wallet only continues the grant after its `continue.wait` time.
const CONTINUE_WAIT_MS = 1000;

export const acceptGrant = async () => {
  await $('button=Accept').waitForClickable();
  await browser.pause(CONTINUE_WAIT_MS);
  await click('button=Accept');
};

export const loginToTestWallet = async () => {
  await browser.url(`${TEST_WALLET_ORIGIN}/auth/login`);
  await $('input[name="email"]').setValue(process.env.TEST_WALLET_USERNAME);
  await $('input[name="password"]').setValue(process.env.TEST_WALLET_PASSWORD);
  await click('button[type="submit"]');
  await browser.waitUntil(
    async () => !(await browser.getUrl()).includes('/auth/login'),
    { timeout: 20_000 },
  );
};

// Needs the popup as the current window. Returns the Connect button selector.
export const fillConnectForm = async (walletAddressUrl: string) => {
  // Retyping the remembered address resets the connect form.
  const address = await $('#connectWalletAddressUrl');
  await address.waitForDisplayed();
  if ((await address.getValue()) !== walletAddressUrl) {
    await address.setValue(walletAddressUrl);
    await browser.keys('Tab');
  }
  // Connect is enabled once the wallet details (and default budget) load.
  const connect = `button*=${await t('connectWallet_connect_action')}`;
  await $(connect).waitForEnabled();
  const amount = await $('#connectAmount');
  await amount.setValue(DEFAULT_BUDGET.toString());
  await browser.keys('Tab');
  await expect(amount).toHaveValue(DEFAULT_BUDGET.toFixed(2));
  const recurring = await $('#connectRecurring');
  if (await recurring.isSelected()) {
    await browser.execute((el) => el.click(), recurring);
  }
  await expect(recurring).not.toBeSelected();
  return connect;
};

export const waitForPostConnect = async () => {
  await browser.waitUntil(
    async () =>
      (await browser.getUrl()).endsWith('/pages/app/index.html#/post-connect'),
    { timeout: 20_000 },
  );
  await expect($('[data-testid="post-connect-result"]')).toHaveText(
    await t('postConnect_connect_success_title'),
    { wait: 20_000 },
  );
};

// Needs the popup as the current window.
export const connectWallet = async (main: string) => {
  await setStorage({
    keyId: process.env.TEST_WALLET_KEY_ID,
    privateKey: process.env.TEST_WALLET_PRIVATE_KEY,
    publicKey: process.env.TEST_WALLET_PUBLIC_KEY,
  });
  await click(await fillConnectForm(process.env.TEST_WALLET_ADDRESS_URL));

  await switchToUrl((url) => url.includes('interactId='));
  await acceptGrant();
  await waitForPostConnect();
  await closeWindows([await browser.getWindowHandle()], main);

  const popup = await openPopup(main);
  await browser.waitUntil(
    async () => (await getStorage(['connected'])).connected,
    { timeout: 30_000, interval: 1000 },
  );
  // The popup moved to the connect route while connecting; start from home.
  await browser.url(`${process.env.EXTENSION_BASE_URL}/popup/index.html`);
  return popup;
};

export const inWindow = async <T>(
  handle: string,
  back: string,
  fn: () => Promise<T>,
) => {
  await browser.switchToWindow(handle);
  const result = await fn();
  await browser.switchToWindow(back);
  return result;
};

export const goToHome = () =>
  browser.url(`${process.env.EXTENSION_BASE_URL}/popup/index.html`);

// Needs the popup as the current window.
export const disconnectWallet = async () => {
  await browser.url(
    `${process.env.EXTENSION_BASE_URL}/popup/index.html#/settings/wallet`,
  );
  const disconnect = await t('settings_wallet_disconnect_ariaLabel_action');
  await click(`button[aria-label="${disconnect}"]`);
  const confirm = await t('settings_wallet_disconnectConfirm_ariaLabel_action');
  await click(`button[aria-label="${confirm}"]`);
  await $('[data-testid="connect-wallet-form"]').waitForDisplayed();
};

// Needs the popup as the current window. Leaves it on the Rate tab.
export const setContinuousPayments = async (enabled: boolean) => {
  await browser.url(
    `${process.env.EXTENSION_BASE_URL}/popup/index.html#/settings/rate`,
  );
  const toggle = await $('[data-testid="continuous-payments-toggle"]');
  if ((await toggle.isSelected()) !== enabled) {
    await browser.execute((el) => el.click(), toggle);
  }
  await browser.waitUntil(async () => (await toggle.isSelected()) === enabled);
};

export type MonetizationEventData = Pick<
  window.MonetizationEvent,
  'walletAddress' | 'amountSent' | 'incomingPayment'
>;

// Opens the playground in the current window and collects its monetization
// events. Remove the returned script when done.
export const setupPlayground = async (walletAddressUrl: string) => {
  const events: MonetizationEventData[] = [];
  const script = await browser.addInitScript<MonetizationEventData>((emit) => {
    window.addEventListener('monetization', (event) => {
      const ev = event as Event & MonetizationEventData;
      emit({
        walletAddress: ev.walletAddress,
        amountSent: {
          currency: ev.amountSent.currency,
          value: ev.amountSent.value,
        },
        incomingPayment: ev.incomingPayment,
      });
    });
  });
  script.on('data', (data) => events.push(data));
  await browser.url(playgroundUrl(walletAddressUrl));
  return { events, script };
};
