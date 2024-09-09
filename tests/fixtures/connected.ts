import type { Page } from '@playwright/test';
import { test as base } from './base';
import { connectWallet, disconnectWallet, openPopup } from '../pages/popup';

export const test = base.extend<{ page: Page }, { popup: Page }>({
  popup: [
    async (
      { persistentContext: context, browserName, background, extensionId },
      use,
    ) => {
      const popup = await openPopup(context, browserName, extensionId);

      const keyInfo = {
        keyId: process.env.CONNECT_KEY_ID!,
        privateKey: process.env.CONNECT_PRIVATE_KEY!,
        publicKey: process.env.CONNECT_PUBLIC_KEY!,
      };
      await connectWallet(context, background, keyInfo, popup, {
        walletAddressUrl: process.env.CONNECT_WALLET_ADDRESS_URL!,
        amount: '10',
        recurring: false,
      });
      await popup.reload({ waitUntil: 'networkidle' });

      await use(popup);

      await disconnectWallet(popup);
      await popup.close();
    },
    { scope: 'worker' },
  ],
});

export const expect = test.expect;
