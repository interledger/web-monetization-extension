import { mergeExpects, type Page } from '@playwright/test';
import { test as base, expect as baseExpect } from './base';
import { connectWallet, disconnectWallet, type Popup } from '../pages/popup';

// With extension connected to the wallet.
export const test = base.extend<{ page: Page }, { popup: Popup }>({
  popup: [
    async ({ persistentContext: context, background, popup, i18n }, use) => {
      const keyInfo = {
        keyId: process.env.TEST_WALLET_KEY_ID,
        privateKey: process.env.TEST_WALLET_PRIVATE_KEY,
        publicKey: process.env.TEST_WALLET_PUBLIC_KEY,
      };
      await connectWallet(context, background, i18n, keyInfo, popup, {
        walletAddressUrl: process.env.TEST_WALLET_ADDRESS_URL,
        amount: '10',
        recurring: false,
      });
      await popup.reload({ waitUntil: 'networkidle' });

      await use(popup);

      await disconnectWallet(popup);
    },
    { scope: 'worker' },
  ],
});

export const expect = mergeExpects(baseExpect, test.expect);
