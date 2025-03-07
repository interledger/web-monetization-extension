import { test, expect } from './fixtures/base';
import { getStorage } from './fixtures/helpers';
import {
  connectWallet,
  disconnectWallet,
  sendOneTimePayment,
} from './pages/popup';
import {
  getContinueWaitTime,
  getWalletInfoCached,
  setupPlayground,
  waitForPage,
} from './helpers/common';
import { completeGrant, DEFAULT_CONTINUE_WAIT_MS } from './helpers/testWallet';
import { transformBalance } from '@/shared/helpers';
import { addMonths } from 'date-fns';
import type { WalletAddress } from '@interledger/open-payments';
import type { AmountValue } from '@/shared/types';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

const INITIAL_AMOUNT = 10;
const NEW_AMOUNT = 15;
const TEST_CASES = [
  {
    name: 'from one-time to recurring',
    from: { recurring: false },
    to: { recurring: true },
  },
  {
    name: 'from recurring to one-time',
    from: { recurring: true },
    to: { recurring: false },
  },
  {
    name: 'from one-time to one-time',
    from: { recurring: false },
    to: { recurring: false },
  },
  {
    name: 'from recurring to recurring',
    from: { recurring: true },
    to: { recurring: true },
  },
];

for (const testCase of TEST_CASES) {
  test.describe('edit wallet budget', () => {
    let walletAddress: WalletAddress;
    let initialAmount: AmountValue;
    let initialAmountFormatted: string;
    let newAmount: AmountValue;
    let newAmountFormatted: string;

    test.beforeAll('get wallet info', async () => {
      walletAddress = await getWalletInfoCached(walletAddressUrl);
      const assetScale = walletAddress.assetScale;
      initialAmount = (INITIAL_AMOUNT * 10 ** assetScale).toString();
      initialAmountFormatted = transformBalance(initialAmount, assetScale);
      newAmount = (NEW_AMOUNT * 10 ** assetScale).toString();
      newAmountFormatted = transformBalance(newAmount, assetScale);
    });

    test.beforeEach(
      'connectWallet',
      async ({ context, background, popup, i18n }) => {
        await connectWallet(context, background, popup, i18n, {
          walletAddressUrl,
          amount: String(INITIAL_AMOUNT),
          recurring: testCase.from.recurring,
        });
      },
    );

    test.afterEach('disconnectWallet', async ({ popup }) => {
      await disconnectWallet(popup);
    });

    test(testCase.name, async ({ context, background, popup, page }) => {
      const settingsLink = popup.locator(`[href="/settings"]`);
      const budgetTab = popup.getByRole('tab', { name: 'Budget' });

      const remainingBalanceInput = popup.getByLabel('Remaining balance');
      const budgetAmountInput = popup.getByLabel('Budget amount');
      const recurringInput = popup.getByRole('switch', { name: 'Monthly' });
      const renewDateMsg = popup.getByTestId('renew-date-msg');

      const fromRecurring = testCase.from.recurring;
      const toRecurring = testCase.to.recurring;

      await test.step('validate initial state', async () => {
        await expect(background).toHaveStorage({
          oneTimeGrantSpentAmount: '0',
          recurringGrantSpentAmount: '0',
        });

        const { oneTimeGrant, recurringGrant } = await getStorage(background, [
          'oneTimeGrant',
          'recurringGrant',
        ]);
        // we only test "type" to avoid logging sensitive info about tokens
        if (fromRecurring) {
          expect(recurringGrant?.type, 'recurring grant exists').toBeDefined();
          expect(
            oneTimeGrant?.type,
            'one-time grant not exists',
          ).toBeUndefined();
        } else {
          expect(oneTimeGrant?.type, 'one-time grant exists').toBeDefined();
          expect(
            recurringGrant?.type,
            'recurring grant not exists',
          ).toBeUndefined();
        }

        await settingsLink.click();
        await budgetTab.click();
        await expect(remainingBalanceInput).toHaveValue(initialAmountFormatted);
        await expect(budgetAmountInput).toHaveValue(initialAmountFormatted);
        await expect(recurringInput).toBeChecked({ checked: fromRecurring });

        await expect(renewDateMsg).toBeVisible({ visible: fromRecurring });
      });

      await test.step('make payment to reduce remaining balance', async () => {
        await setupPlayground(page, walletAddressUrl);

        await popup.reload();
        await sendOneTimePayment(popup, '2.00', true);
        // Make an extra payment to update balance:
        // https://github.com/interledger/web-monetization-extension/issues/737
        await sendOneTimePayment(popup, '0.50', true);

        await settingsLink.click();
        await budgetTab.click();

        const remainingBalance = Number(
          await remainingBalanceInput.getAttribute('value'),
        );
        expect(remainingBalance).toBeLessThan(INITIAL_AMOUNT);

        await page.close(); // so no new payments get made
      });

      const submitButton = await test.step('edit budget amount', async () => {
        const submitButton = popup.getByRole('button', {
          name: 'Submit changes',
        });
        await expect(submitButton).toBeDisabled();

        await budgetAmountInput.fill(newAmountFormatted);
        await recurringInput.setChecked(toRecurring, { force: true });

        await expect(submitButton).toBeEnabled();

        await expect(renewDateMsg).toBeVisible({ visible: toRecurring });
        if (toRecurring) {
          await expect(renewDateMsg.locator('time')).toHaveAttribute(
            'datetime',
            expect.stringContaining(
              addMonths(new Date(), 1).toISOString().slice(0, 16),
            ),
          );
        }

        return submitButton;
      });

      await test.step('sets new grant on budget edit', async () => {
        const continueWaitMsPromise = getContinueWaitTime(
          context,
          { walletAddressUrl },
          DEFAULT_CONTINUE_WAIT_MS,
        );
        await submitButton.click();
        const newPage = await waitForPage(context, (url) =>
          url.includes('/grant-interactions'),
        );
        const continueWaitMs = await continueWaitMsPromise;
        await completeGrant(newPage, continueWaitMs);
        await expect(newPage).toHaveURL(
          (url) => url.searchParams.get('intent') === 'update_budget',
        );
        await newPage.close();

        const newGrants = await getStorage(background, [
          'oneTimeGrant',
          'recurringGrant',
          'recurringGrantSpentAmount',
          'oneTimeGrantSpentAmount',
        ]);
        expect(newGrants.oneTimeGrantSpentAmount).toBe('0');
        expect(newGrants.recurringGrantSpentAmount).toBe('0');

        // intentionally comparing amount only to prevent displaying secret tokens
        // if this expectation fails
        if (toRecurring) {
          expect(newGrants.recurringGrant?.amount).toEqual({
            value: newAmount,
            interval: expect.stringMatching(/^R\/\d{4}-\d{2}-\d{2}.+\/P1M$/),
          });
          expect(newGrants.oneTimeGrant?.amount).toBeUndefined();
        } else {
          expect(newGrants.oneTimeGrant?.amount).toEqual({
            value: newAmount,
            // no interval here
          });
          expect(newGrants.recurringGrant?.amount).toBeUndefined();
        }
      });

      await test.step('shows new budget', async () => {
        await popup.reload();
        await settingsLink.click();
        await budgetTab.click();

        await expect(remainingBalanceInput).toHaveValue(newAmountFormatted);
        await expect(budgetAmountInput).toHaveValue(newAmountFormatted);
        await expect(recurringInput).toBeChecked({ checked: toRecurring });
        await expect(renewDateMsg).toBeVisible({ visible: toRecurring });
        await expect(submitButton).toBeDisabled();
      });
    });
  });
}
