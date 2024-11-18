/// <reference types="chrome"/>
import { test, expect } from './fixtures/base';
import { connectWallet, disconnectWallet } from './pages/popup';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test('connects with correct details provided', async ({
  persistentContext,
  background,
  popup,
  i18n,
  page,
}) => {
  const {
    TEST_WALLET_KEY_ID,
    TEST_WALLET_PRIVATE_KEY,
    TEST_WALLET_PUBLIC_KEY,
    TEST_WALLET_ADDRESS_URL,
  } = process.env;
  expect(TEST_WALLET_KEY_ID).toBeDefined();
  expect(TEST_WALLET_PRIVATE_KEY).toBeDefined();
  expect(TEST_WALLET_PUBLIC_KEY).toBeDefined();
  expect(TEST_WALLET_ADDRESS_URL).toBeDefined();

  expect(
    await background.evaluate(() => {
      return chrome.storage.local.get(['connected']);
    }),
  ).toEqual({ connected: false });

  const keyInfo = {
    keyId: TEST_WALLET_KEY_ID,
    privateKey: TEST_WALLET_PRIVATE_KEY,
    publicKey: TEST_WALLET_PUBLIC_KEY,
  };
  await connectWallet(persistentContext, background, i18n, keyInfo, popup, {
    walletAddressUrl: TEST_WALLET_ADDRESS_URL,
    amount: '10',
    recurring: false,
  });
  await popup.reload();

  const settingsLink = popup.locator(`[href="/settings"]`).first();
  await expect(settingsLink).toBeVisible();

  const storage = await background.evaluate(() => {
    return chrome.storage.local.get([
      'connected',
      'oneTimeGrant',
      'recurringGrant',
    ]);
  });
  expect(storage).toMatchObject({
    connected: true,
    recurringGrant: null,
    oneTimeGrant: {
      type: 'one-time',
      amount: {
        value: '1000', // asset scale 2
      },
    },
  });

  await page.goto('https://webmonetization.org/play/');
  await expect(popup.locator('h3')).toHaveText(
    i18n.getMessage('notMonetized_text_noLinks'),
  );

  await disconnectWallet(popup);
  expect(
    await background.evaluate(() => {
      return chrome.storage.local.get(['connected']);
    }),
  ).toEqual({ connected: false });
});
