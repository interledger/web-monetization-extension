/// <reference types="chrome"/>
import type { Storage, StorageKey } from '../../../src/shared/types';

const TEST_WALLET_ORIGIN = 'https://wallet.interledger-test.dev';

// Needs an extension page (e.g. the popup) as the current window.
export const t = (key: string) =>
  browser.execute((key: string) => chrome.i18n.getMessage(key), key);

export const getStorage = (keys: StorageKey[]) =>
  browser.executeAsync(
    (keys: StorageKey[], done: (data: Partial<Storage>) => void) => {
      chrome.storage.local.get(keys).then(done);
    },
    keys,
  );

export const setStorage = (data: Partial<Storage>) =>
  browser.executeAsync((data: Partial<Storage>, done: () => void) => {
    chrome.storage.local.set(data).then(done);
  }, data);

export const click = async (selector: string) => {
  const el = $(selector);
  await el.scrollIntoView({ block: 'center' });
  // Messages under the popup inputs can briefly cover the button.
  await el.waitForClickable();
  await el.click();
};

export const switchToUrl = (
  match: (url: string) => boolean,
  timeout = 20_000,
) =>
  browser.waitUntil(
    async () => {
      for (const handle of await browser.getWindowHandles()) {
        await browser.switchToWindow(handle);
        if (match(await browser.getUrl())) return true;
      }
      return false;
    },
    { timeout, interval: 500 },
  );

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
