import { mergeExpects, type Page } from '@playwright/test';
import { test as base, expect as baseExpect } from './base';
import { connectWallet, disconnectWallet, type Popup } from '../pages/popup';

// With extension connected to the wallet.
export const test = base.extend<{ page: Page }, { popup: Popup }>({
  popup: [
    async ({ context, background, popup, i18n }, use) => {
      await connectWallet(context, background, popup, i18n, {
        walletAddressUrl: process.env.TEST_WALLET_ADDRESS_URL,
        amount: '10',
        recurring: false,
      });
      await popup.reload();

      await use(popup);

      await disconnectWallet(popup);
    },
    { scope: 'test', timeout: 20_000 },
  ],
});

export const expect = mergeExpects(baseExpect, test.expect);
