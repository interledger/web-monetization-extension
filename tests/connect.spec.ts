/// <reference types="chrome"/>
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/base';
import {
  connectWallet,
  disconnectWallet,
  fillPopup,
  getMessage,
  openPopup,
} from './pages/popup';

let popup: Page;
test.beforeAll(async ({ persistentContext, browserName, extensionId }) => {
  popup = await openPopup(persistentContext, browserName, extensionId);
});

test.afterAll(async () => {
  await popup.close();
});

test.beforeEach(async () => {
  await popup.reload();
});

test.describe('shows error with invalid wallet address', () => {
  test('invalid URL', async ({ background }) => {
    const connectButton = await fillPopup(popup, {
      walletAddressUrl: 'abc',
      amount: '10',
      recurring: false,
    });
    await connectButton.click();
    await expect(popup.locator('p.text-error')).toHaveText('Failed to fetch');
    expect(
      await background.evaluate(() => {
        return chrome.storage.local.get(['connected']);
      }),
    ).toEqual({ connected: false });
  });

  test('invalid wallet address', async ({ background }) => {
    const connectButton = await fillPopup(popup, {
      walletAddressUrl: 'https://example.com',
      amount: '10',
      recurring: false,
    });
    await expect(popup.locator('p.text-error')).toContainText(
      'Invalid wallet address.',
    );

    await connectButton.click();
    await expect(popup.locator('p.text-error')).toContainText(
      'Unexpected token',
    );
    expect(
      await background.evaluate(() => {
        return chrome.storage.local.get(['connected']);
      }),
    ).toEqual({ connected: false });
  });
});

test('connects with correct details provided', async ({
  persistentContext,
  background,
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

  const keyInfo = {
    keyId: CONNECT_KEY_ID!,
    privateKey: CONNECT_PRIVATE_KEY!,
    publicKey: CONNECT_PUBLIC_KEY!,
  };

  expect(
    await background.evaluate(() => {
      return chrome.storage.local.get(['connected']);
    }),
  ).toEqual({ connected: false });

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
