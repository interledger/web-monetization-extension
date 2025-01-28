import { test, expect } from './fixtures/base';
import { getStorage } from './fixtures/helpers';
import { getContinueWaitTime, setupPlayground } from './helpers/common';
import { completeGrant, DEFAULT_CONTINUE_WAIT_MS } from './helpers/testWallet';
import {
  connectWallet,
  disconnectWallet,
  sendOneTimePayment,
} from './pages/popup';
import { transformBalance } from '@/shared/helpers';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;

test.describe('wallet budget edit to one-time', () => {
  test.beforeAll(async ({ background, popup, persistentContext, i18n }) => {
    await connectWallet(persistentContext, background, i18n, null, popup, {
      walletAddressUrl,
      amount: '10',
      recurring: false,
    });
  });

  test.afterAll(async ({ popup }) => {
    await disconnectWallet(popup);
  });

  test('edit wallet budget from one-time to one-time', async ({
    popup,
    background,
    persistentContext: context,
    page,
  }) => {
    const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
    const newAmount = '15.00';

    const { oneTimeGrant, walletAddress } = await getStorage(background, [
      'oneTimeGrant',
      'walletAddress',
    ]);
    const budgetAmount = transformBalance(
      oneTimeGrant!.amount.value,
      walletAddress!.assetScale,
    );

    const settingsLink = popup.locator(`[href="/settings"]`);
    const budgetTab = popup.getByRole('tab', { name: 'Budget' });

    const remainingBalanceInput = popup.getByLabel('Remaining balance');
    const budgetAmountInput = popup.getByLabel('Budget amount');
    const recurringInput = popup.getByRole('switch', { name: 'Monthly' });

    await test.step('validate initial state', async () => {
      await expect(background).toHaveStorage({
        oneTimeGrantSpentAmount: '0',
        recurringGrantSpentAmount: '0',
      });

      await settingsLink.click();
      await budgetTab.click();
      await expect(remainingBalanceInput).toHaveValue(budgetAmount);
      await expect(budgetAmountInput).toHaveValue(budgetAmount);
      await expect(recurringInput).not.toBeChecked();

      const { oneTimeGrant, recurringGrant } = await getStorage(background, [
        'oneTimeGrant',
        'recurringGrant',
      ]);
      // we only test "type" to avoid logging sensitive info about tokens
      expect(oneTimeGrant?.type, 'one-time grant exists').toBeDefined();
      expect(
        recurringGrant?.type,
        'recurring grant not exists',
      ).toBeUndefined();
    });

    await test.step('make payment to reduce remaining balance', async () => {
      await setupPlayground(page, walletAddressUrl);

      await popup.reload();
      await sendOneTimePayment(popup, '2.00', true);
      // Make an extra payment to update balance:
      // https://github.com/interledger/web-monetization-extension/issues/737
      await sendOneTimePayment(popup, '0.50', true);

      const remainingBalance = await popup
        .getByTestId('remaining-balance')
        .getAttribute('data-value');
      expect(Number(remainingBalance)).toBeLessThan(Number(budgetAmount));

      await page.close(); // so no new payments get made
    });

    const submitButton = await test.step('edit budget amount', async () => {
      await settingsLink.click();
      await budgetTab.click();

      const submitButton = popup.getByRole('button', {
        name: 'Submit changes',
      });
      await expect(submitButton).toBeDisabled();

      await budgetAmountInput.fill(newAmount);
      await recurringInput.uncheck({ force: true });

      await expect(submitButton).toBeEnabled();
      // FIXME: https://github.com/interledger/web-monetization-extension/issues/846
      // await expect(popup.getByTestId('renew-date-msg')).not.toBeVisible();

      return submitButton;
    });

    await test.step('sets new grant on budget edit', async () => {
      const continueWaitMsPromise = getContinueWaitTime(
        context,
        { walletAddressUrl },
        DEFAULT_CONTINUE_WAIT_MS,
      );
      await submitButton.click();
      const newPage = await context.waitForEvent('page', (page) =>
        page.url().includes('/grant-interactions'),
      );
      const continueWaitMs = await continueWaitMsPromise;
      await completeGrant(newPage, continueWaitMs);
      expect(newPage.url()).toContain('intent=update_budget');
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
      expect(newGrants.oneTimeGrant?.amount).toMatchObject({
        value: (Number(newAmount) * 10 ** walletAddress!.assetScale).toString(),
      });

      expect(newGrants.oneTimeGrant).not.toBeNull();
      expect(newGrants.recurringGrant).toBeNull();
    });

    await test.step('shows new budget', async () => {
      await popup.reload();
      await settingsLink.click();
      await budgetTab.click();

      await expect(remainingBalanceInput).toHaveValue(newAmount);
      await expect(budgetAmountInput).toHaveValue(newAmount);
      await expect(recurringInput).not.toBeChecked();
      await expect(submitButton).toBeDisabled();
    });
  });
});
