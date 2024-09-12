/// <reference types="chrome"/>
import { test, expect } from './fixtures/base';
import { connectWallet, disconnectWallet } from './pages/popup';
import { getMessage } from './helpers';

test.beforeEach(async ({ popup }) => {
  await popup.reload();
});

test('connects with correct details provided', async ({
  persistentContext,
  background,
  popup,
}) => {
  const {
    CONNECT_KEY_ID,
    CONNECT_PRIVATE_KEY,
    CONNECT_PUBLIC_KEY,
    CONNECT_WALLET_ADDRESS_URL,
  } = process.env;
  expect(CONNECT_KEY_ID).toBeDefined();
  expect(CONNECT_PRIVATE_KEY).toBeDefined();
  expect(CONNECT_PUBLIC_KEY).toBeDefined();
  expect(CONNECT_WALLET_ADDRESS_URL).toBeDefined();

  expect(
    await background.evaluate(() => {
      return chrome.storage.local.get(['connected']);
    }),
  ).toEqual({ connected: false });

  const keyInfo = {
    keyId: CONNECT_KEY_ID!,
    privateKey: CONNECT_PRIVATE_KEY!,
    publicKey: CONNECT_PUBLIC_KEY!,
  };
  await connectWallet(persistentContext, background, keyInfo, popup, {
    walletAddressUrl: CONNECT_WALLET_ADDRESS_URL!,
    amount: '10',
    recurring: false,
  });
  await popup.reload();

  const settingsLink = popup.locator(`[href="/settings"]`).first();
  await expect(settingsLink).toBeVisible();

  await expect(popup.locator('h3')).toHaveText(
    getMessage('siteNotMonetized_state_text'),
  );

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
        value: '10000000000', // asset scale 9
      },
    },
  });

  await disconnectWallet(popup);
  expect(
    await background.evaluate(() => {
      return chrome.storage.local.get(['connected']);
    }),
  ).toEqual({ connected: false });
});
