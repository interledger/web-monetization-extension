import { test, expect } from './fixtures/base';
import { getStorage } from './fixtures/helpers';
import {
  connectWallet,
  disconnectWallet,
  goToHome,
  locators,
  sendOneTimePayment,
  setContinuousPayments,
} from './pages/popup';
import {
  getContinueWaitTime,
  getWalletInfoCached,
  setupPlayground,
  waitForPage,
} from './helpers/common';
import { completeGrant, DEFAULT_CONTINUE_WAIT_MS } from './helpers/testWallet';
import { getNextOccurrence, transformBalance } from '@/shared/helpers';
import type { WalletAddress } from '@interledger/open-payments';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

const INITIAL_AMOUNT = 5;
const NEW_AMOUNT = 6;
const TEST_CASES = [
  {
    name: 'recurring budget, top-up recurring',
    from: { recurring: true },
    to: { recurring: true },
  },
  {
    name: 'recurring budget, top-up one-time',
    from: { recurring: true },
    to: { recurring: false },
  },
  {
    name: 'one-time budget, top-up recurring',
    from: { recurring: false },
    to: { recurring: true },
  },
  {
    name: 'one-time budget, top-up one-time',
    from: { recurring: false },
    to: { recurring: false },
  },
];

for (const testCase of TEST_CASES) {
  test.describe('out of funds', () => {
    let walletAddress: WalletAddress;
    let initialAmount: number;
    let initialAmountFormatted: string;
    let newAmount: number;
    let newAmountFormatted: string;
    let amountToSend: string;
    let locale: string;

    test.beforeAll('get wallet info', async ({ background }) => {
      walletAddress = await getWalletInfoCached(walletAddressUrl);
      const assetScale = walletAddress.assetScale;
      initialAmount = INITIAL_AMOUNT * 10 ** assetScale;
      initialAmountFormatted = transformBalance(
        initialAmount.toString(),
        assetScale,
      );
      newAmount = NEW_AMOUNT * 10 ** assetScale;
      newAmountFormatted = transformBalance(newAmount.toString(), assetScale);
      amountToSend = transformBalance(
        (initialAmount / 2).toString(),
        assetScale,
      );

      locale = await background.evaluate(() => navigator.language);
    });

    test.beforeEach(
      'connectWallet and disable continuous payments',
      async ({ context, background, popup, i18n }) => {
        await connectWallet(context, background, popup, i18n, {
          walletAddressUrl,
          amount: String(INITIAL_AMOUNT),
          recurring: testCase.from.recurring,
        });

        // disable continuous payments so we reach out-of-funds manually quickly.
        await setContinuousPayments(popup, false);
        await expect(background).toHaveStorage({
          continuousPaymentsEnabled: false,
        });
        await goToHome(popup);
      },
    );

    test.afterEach('disconnectWallet', async ({ popup }) => {
      await disconnectWallet(popup);
    });

    test(testCase.name, async ({ context, background, popup, page, i18n }) => {
      const fromRecurring = testCase.from.recurring;
      const toRecurring = testCase.to.recurring;

      const addRecurringButton = popup.getByRole('button', {
        name: i18n.getMessage('outOfFunds_action_optionRecurring'),
      });
      const addOneTimeButton = popup.getByRole('button', {
        name: i18n.getMessage('outOfFunds_action_optionOneTime'),
      });

      const monetizationCallback = await setupPlayground(
        page,
        walletAddressUrl,
      );

      await test.step('send one-time payment to deplete funds', async () => {
        // Send two payments so grantSpentAmount changes. Ideally, we'd send a single
        // payment with full amount, but:
        // https://github.com/interledger/web-monetization-extension/issues/737
        await sendOneTimePayment(popup, amountToSend, true);
        await expect(popup.getByRole('alert')).toHaveText(
          i18n.getMessage('pay_state_success'),
        );
        await popup.reload(); // XXX: not able to send two consecutive payments in tests
        await sendOneTimePayment(popup, amountToSend, true);
        await expect(popup.getByRole('alert')).toHaveText(
          i18n.getMessage('pay_state_success'),
        );
        await expect(monetizationCallback).toHaveBeenCalledTimes(2);
      });

      await test.step('trigger out-of-funds with a micro-payment', async () => {
        await setContinuousPayments(popup, true);
        await expect(background).toHaveStorage({
          continuousPaymentsEnabled: true,
        });
        await goToHome(popup);

        await expect(popup.getByRole('alert')).toBeVisible({ timeout: 10_000 });
        await expect(popup.getByRole('alert')).toHaveText(
          i18n.getMessage('outOfFunds_error_title'),
        );

        await expect(background).toHaveStorage({
          state: expect.objectContaining({ out_of_funds: true }),
        });

        await expect(
          popup.getByTestId('out-of-funds-recurring-info'),
        ).toBeVisible({ visible: fromRecurring });

        await expect(addRecurringButton).toBeVisible();
        await expect(addOneTimeButton).toBeVisible();

        // disable continuous payments again so we can check final balance reliably
        await setContinuousPayments(popup, false);
        await expect(background).toHaveStorage({
          continuousPaymentsEnabled: false,
        });
        await goToHome(popup);
      });

      await test.step('set new budget', async () => {
        // clear overpaying state for current page so we can see next payment go through
        await page.close();

        if (toRecurring) {
          await addRecurringButton.click();
        } else {
          await addOneTimeButton.click();
        }

        await test.step('check add-funds screen', async () => {
          const inputField = popup.getByRole('textbox', {
            name: i18n.getMessage('outOfFundsAddFunds_label_amount'),
          });
          await expect(inputField).toBeVisible();
          await expect(inputField).toHaveValue(initialAmountFormatted);

          await expect(
            popup.locator(`a[href="/out-of-funds"]`),
            'has link to previous screen',
          ).toBeVisible();

          const desc = popup.getByTestId('input-amount_outOfFunds-description');
          await expect(desc).toBeVisible();
          if (toRecurring) {
            const nextOccurrence = getNextOccurrence(
              `R/${new Date().toISOString()}/P1M`,
            );
            const nextOccurrenceDate = nextOccurrence.toLocaleDateString(
              locale,
              { dateStyle: 'medium' },
            );
            const msg = i18n.getMessage(
              'outOfFundsAddFunds_label_amountDescriptionRecurring',
              [nextOccurrenceDate],
            );
            await expect(desc).toHaveText(msg);
          } else {
            const msg = i18n.getMessage(
              'outOfFundsAddFunds_label_amountDescriptionOneTime',
            );
            await expect(desc).toHaveText(msg);
          }

          await inputField.fill(newAmountFormatted);
        });

        await test.step('complete new grant', async () => {
          const submitButton = popup.getByRole('button', {
            name: toRecurring
              ? i18n.getMessage('outOfFundsAddFunds_action_addRecurring')
              : i18n.getMessage('outOfFundsAddFunds_action_addOneTime'),
          });
          await submitButton.click();

          const continueWaitMsPromise = getContinueWaitTime(
            context,
            { walletAddressUrl },
            DEFAULT_CONTINUE_WAIT_MS,
          );

          const consentPage = await waitForPage(context, (url) =>
            url.includes('/grant-interactions'),
          );
          await completeGrant(consentPage, await continueWaitMsPromise);
          await consentPage.close();
        });
      });

      await test.step('creates new grants correctly', async () => {
        const newGrants = await getStorage(background, [
          'oneTimeGrant',
          'recurringGrant',
          'recurringGrantSpentAmount',
          'oneTimeGrantSpentAmount',
        ]);

        if (fromRecurring) {
          expect(newGrants.oneTimeGrantSpentAmount).toBe('0');
          if (toRecurring) {
            expect(newGrants.recurringGrantSpentAmount).toBe('0');
          } else {
            expect(newGrants.recurringGrantSpentAmount).not.toBe('0');
          }
        } /* else if (fromOneTime) */ else {
          expect(newGrants.recurringGrantSpentAmount).toBe('0');
          if (toRecurring) {
            expect(newGrants.oneTimeGrantSpentAmount).not.toBe('0');
          } else {
            expect(newGrants.oneTimeGrantSpentAmount).toBe('0');
          }
        }
      });

      await test.step('can pay again', async () => {
        await expect(background).toHaveStorage({
          state: expect.objectContaining({ out_of_funds: false }),
        });
        await goToHome(popup);

        const page = await context.newPage();
        await setupPlayground(page, walletAddressUrl);

        await expect(popup.getByTestId('home-page')).toBeVisible();

        await locators.settingsLink(popup).click();
        await popup.getByRole('tab', { name: 'Budget' }).click();

        const budgetAmountInput = popup.getByLabel('Budget amount');
        await expect(budgetAmountInput).toHaveValue(
          toRecurring || !fromRecurring
            ? newAmountFormatted
            : initialAmountFormatted,
        );

        const remainingBalanceInput = popup.getByLabel('Remaining balance');
        if (fromRecurring === toRecurring) {
          await expect(
            remainingBalanceInput,
            'Remaining balance is new budget',
          ).toHaveValue(newAmountFormatted);
        } else {
          const { oneTimeGrantSpentAmount, recurringGrantSpentAmount } =
            await getStorage(background, [
              'oneTimeGrantSpentAmount',
              'recurringGrantSpentAmount',
            ]);
          const total = transformBalance(
            BigInt(oneTimeGrantSpentAmount ?? '0') +
              BigInt(recurringGrantSpentAmount ?? '0') +
              BigInt(newAmount),
            walletAddress.assetScale,
          );
          await expect(
            remainingBalanceInput,
            'Remaining balance is old budget + new',
          ).toHaveValue(total);
        }
      });
    });
  });
}
