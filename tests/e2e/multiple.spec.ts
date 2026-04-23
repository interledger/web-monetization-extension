import { MIN_PAYMENT_WAIT } from '@/background/config';
import { test, expect, DEFAULT_BUDGET } from './fixtures/connected';
import {
  getWalletInfoCached,
  interceptPaymentCreateRequests,
  setupPlayground,
} from './helpers/common';
import {
  goToHome,
  sendOneTimePayment,
  setContinuousPayments,
} from './pages/popup';
import { transformBalance } from '@/shared/helpers';
import type { WalletAddress } from '@interledger/open-payments';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
const walletAddressUrlSameCurrency = process.env.TEST_WALLET_ADDRESS_URL_E;
const walletAddressUrlWeakerCurrency = process.env.TEST_WALLET_ADDRESS_URL_W;
const walletAddressUrlStrongerCurrency = process.env.TEST_WALLET_ADDRESS_URL_S;

let walletInfoConnected: WalletAddress;
let walletInfoSameCurrency: WalletAddress;
let walletInfoWeakerCurrency: WalletAddress;
let walletInfoStrongerCurrency: WalletAddress;
test.beforeAll('get wallet addresses info', async () => {
  [
    walletInfoConnected,
    walletInfoSameCurrency,
    walletInfoWeakerCurrency,
    walletInfoStrongerCurrency,
  ] = await Promise.all([
    getWalletInfoCached(walletAddressUrl),
    getWalletInfoCached(walletAddressUrlSameCurrency),
    getWalletInfoCached(walletAddressUrlWeakerCurrency),
    getWalletInfoCached(walletAddressUrlStrongerCurrency),
  ]);
});

// param amountToSend in human-format (e.g. 1.2 for $1.20).
// There's 1% transaction fee on test wallet when using same currencies. For
// cross-currency, different assets have different rates?
const getRecvAmount = (
  amountToSend: number,
  { assetScale }: Pick<WalletAddress, 'assetScale'>,
  count = 1,
) => {
  const splitAmount = (amountToSend * 10 ** assetScale) / count;
  return Number(
    transformBalance(Math.round(splitAmount * 0.99).toString(), assetScale),
  );
};

const orderById = <T extends { id: string }>(a: T, b: T) =>
  a.id.localeCompare(b.id);

test.describe('should monetized site with multiple wallet address', () => {
  test('same currency', async ({ page, popup, background, context }) => {
    // At rateOfPay=3600, we pay $0.01 every second. But given minimum interval
    // is 2s, we'll need to wait for 2s.
    const rateOfPay = '3600';
    const interval = MIN_PAYMENT_WAIT;
    await background.evaluate((rateOfPay) => {
      return chrome.storage.local.set({ rateOfPay });
    }, rateOfPay);

    const walletAddresses = [
      walletAddressUrl,
      walletAddressUrlSameCurrency,
    ].sort();
    const count = walletAddresses.length;
    const monetizationCallback = await setupPlayground(
      page,
      ...walletAddresses,
    );

    await test.step('continuous payments', async () => {
      await expect(monetizationCallback).toHaveBeenCalledTimes(1);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[0],
      });

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(2);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[1],
      });

      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called once for each wallet address',
      ).toEqual([...walletAddresses].sort());

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(3);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[0],
      });

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(4);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[1],
      });

      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called twice for each wallet address',
      ).toEqual([...walletAddresses, ...walletAddresses].sort());
    });

    await setContinuousPayments(popup, false);
    await goToHome(popup);
    monetizationCallback.reset();

    await test.step('one-time payments', async () => {
      const amountToSend = DEFAULT_BUDGET.amount / 2;

      await sendOneTimePayment(popup, amountToSend.toFixed(2));
      await expect(monetizationCallback).toHaveBeenCalledTimes(count);
      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called once for each wallet address',
      ).toEqual(walletAddresses);

      const splitRecvAmount = getRecvAmount(
        amountToSend,
        walletInfoConnected,
        count,
      );

      expect(
        monetizationCallback.calls.map(([ev]) => Number(ev.amountSent.value)),
        'amount is sent split equally in each wallet address',
      ).toEqual(
        Array.from({ length: count }, () => expect.closeTo(splitRecvAmount, 1)),
      );
    });
  });

  test('different currencies', async ({ page, popup, background, context }) => {
    // At rateOfPay=3600, we pay $0.01 every second. But given minimum interval
    // is 2s, we'll need to wait for 2s.
    const rateOfPay = '3600';
    const interval = MIN_PAYMENT_WAIT;
    await background.evaluate((rateOfPay) => {
      return chrome.storage.local.set({ rateOfPay });
    }, rateOfPay);

    const walletAddressesInfo = [
      walletInfoSameCurrency,
      walletInfoWeakerCurrency,
      walletInfoStrongerCurrency,
    ].sort(orderById);
    const walletAddresses = walletAddressesInfo.map((e) => e.id);
    const count = walletAddressesInfo.length;

    const monetizationCallback = await setupPlayground(
      page,
      ...walletAddresses,
    );

    await test.step('continuous payments', async () => {
      await expect(monetizationCallback).toHaveBeenCalledTimes(1);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[0],
      });

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(2);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[1],
      });

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(3);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[2],
      });

      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called once for each wallet address',
      ).toEqual([...walletAddresses].sort());

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(4);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[0],
      });

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(5);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[1],
      });

      await context.clock.runFor(interval);
      await expect(monetizationCallback).toHaveBeenCalledTimes(6);
      await expect(monetizationCallback).toHaveBeenLastCalledWithMatching({
        paymentPointer: walletAddresses[2],
      });

      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called twice for each wallet address',
      ).toEqual([...walletAddresses, ...walletAddresses].sort());
    });

    await setContinuousPayments(popup, false);
    await goToHome(popup);
    monetizationCallback.reset();
    const { outgoingPaymentCreatedCallback } =
      interceptPaymentCreateRequests(context);

    await test.step('one-time payments', async () => {
      const amountToSend = DEFAULT_BUDGET.amount - 1;
      const splitAmount = Math.round(
        (amountToSend * 10 ** walletInfoConnected.assetScale) / count,
      );

      await sendOneTimePayment(popup, amountToSend.toFixed(2));
      await expect(monetizationCallback).toHaveBeenCalledTimes(count);
      await expect(outgoingPaymentCreatedCallback).toHaveBeenCalledTimes(count);
      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called once for each wallet address',
      ).toEqual(walletAddresses);

      const outgoingPayments = outgoingPaymentCreatedCallback.calls.map(
        ([{ receiveAmount, debitAmount }]) => ({
          receiveAmount,
          debitAmount,
        }),
      );

      expect(
        outgoingPayments,
        'outgoing payments created with same split debit amount',
      ).toEqual(
        Array.from({ length: count }, () =>
          expect.objectContaining({
            debitAmount: {
              assetCode: walletInfoConnected.assetCode,
              assetScale: walletInfoConnected.assetScale,
              value: splitAmount.toString(),
            },
          }),
        ),
      );

      const monetizationCallbackCalls = monetizationCallback.calls.map(
        ([ev]) => ({
          id: ev.paymentPointer,
          currency: ev.amountSent.currency,
          amount: Number(ev.amountSent.value),
        }),
      );

      const expected = walletAddressesInfo.map((wa) => {
        const { id, assetCode, assetScale } = wa;
        // Can't use getRecvAmount with currency conversion here. Fee differs
        // across currencies on test wallet - not exactly 1%. So let's map
        // outgoingPayment to test amounts in monetization callbacks.
        const outgoingPayment = outgoingPayments.find(
          (e) => e.receiveAmount.assetCode === assetCode,
        )!;
        const amount = Number(
          transformBalance(outgoingPayment.receiveAmount.value, assetScale),
        );
        return {
          id: id,
          currency: assetCode,
          amount: expect.closeTo(amount, 0),
        };
      });

      expect(
        monetizationCallbackCalls.sort(orderById),
        'amount is sent split equally in each wallet address',
      ).toEqual(expected.sort(orderById));
    });
  });
});
