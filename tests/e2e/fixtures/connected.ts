import { mergeExpects, type Page } from '@playwright/test';
import { test as base, expect as baseExpect } from './base';
import {
  connectWallet,
  disconnectWallet,
  goToHome,
  type Popup,
} from '../pages/popup';

export const DEFAULT_BUDGET = {
  /** amount is what user fills in budget's amount field, parsed as Number */
  amount: 10,
  recurring: false,
};

// With extension connected to the wallet.
export const test = base.extend<{ page: Page }, { popup: Popup }>({
  popup: [
    async ({ context, background, popup, i18n }, use) => {
      await connectWallet(context, background, popup, i18n, {
        walletAddressUrl: process.env.TEST_WALLET_ADDRESS_URL,
        amount: DEFAULT_BUDGET.amount.toString(),
        recurring: DEFAULT_BUDGET.recurring,
      });
      await goToHome(popup);

      await use(popup);

      await disconnectWallet(popup);
    },
    { scope: 'test', timeout: 20_000 },
  ],
});

export const expect = mergeExpects(baseExpect, test.expect);
