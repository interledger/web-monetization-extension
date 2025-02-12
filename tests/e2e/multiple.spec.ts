import type { WalletAddress } from '@interledger/open-payments';
import { test, expect, DEFAULT_BUDGET } from './fixtures/connected';
import { getWalletInfoCached, setupPlayground } from './helpers/common';
import {
  goToHome,
  sendOneTimePayment,
  setContinuousPayments,
} from './pages/popup';
import { transformBalance } from '@/shared/helpers';
import { getExchangeRates, getRateOfPay } from '@/background/utils';

const walletAddressUrl = process.env.TEST_WALLET_ADDRESS_URL;
const walletAddressUrlSameCurrency = process.env.TEST_WALLET_ADDRESS_URL_E;
const walletAddressUrlWeakerCurrency = process.env.TEST_WALLET_ADDRESS_URL_W;
const walletAddressUrlStrongerCurrency = process.env.TEST_WALLET_ADDRESS_URL_S;

let walletInfoConnected: WalletAddress;
let walletInfoSameCurrency: WalletAddress;
let walletInfoWeakerCurrency: WalletAddress;
let walletInfoStrongerCurrency: WalletAddress;
let exchangeRates: Awaited<ReturnType<typeof getExchangeRates>>;
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
  exchangeRates = await getExchangeRates();
});

// param amount is in bigint format (e.g. 1.2 at assetScale 2 would be 120)
// 1 unit less by @interledger/pay and 1% transaction fee on test wallet.
const getAmountAfterFee = (amount: number) =>
  Math.round(Number((amount - 1) * 0.99));

const orderById = <T extends { id: string }>(a: T, b: T) =>
  a.id.localeCompare(b.id);

test.describe('should monetized site with multiple wallet address', () => {
  test.skip('same currency', async ({ page, popup }) => {
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
      await expect(monetizationCallback).toHaveBeenCalledTimes(count);
      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called once for each wallet address',
      ).toEqual(walletAddresses);
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

      const { assetScale } = walletInfoSameCurrency;
      const splitRecvAmount = Number(
        transformBalance(
          getAmountAfterFee(
            (amountToSend * 10 ** assetScale) / count,
          ).toString(),
          assetScale,
        ),
      );

      expect(
        monetizationCallback.calls.map(([ev]) => Number(ev.amountSent.value)),
        'amount is sent split equally in each wallet address',
      ).toEqual(
        Array.from({ length: count }, () => expect.closeTo(splitRecvAmount, 1)),
      );
    });
  });

  test('different currencies', async ({ page, popup }) => {
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
      await expect(monetizationCallback).toHaveBeenCalledTimes(count);
      expect(
        monetizationCallback.calls.map(([ev]) => ev.paymentPointer).sort(),
        'monetization callback is called once for each wallet address',
      ).toEqual(walletAddresses);
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

      const splitAmount =
        (amountToSend * 10 ** walletInfoConnected.assetScale) / count;
      const splitAmountAfterFee = getAmountAfterFee(splitAmount).toString();

      const monetizationCallbackCalls = monetizationCallback.calls.map(
        ([ev]) => ({
          id: ev.paymentPointer,
          currency: ev.amountSent.currency,
          amount: Number(ev.amountSent.value),
        }),
      );

      const expected = walletAddressesInfo.map((wa) => {
        const { id, assetCode, assetScale } = wa;
        const amount = getRateOfPay({
          rate: splitAmountAfterFee,
          exchangeRate: exchangeRates.rates[assetCode],
          assetScale: assetScale,
        });
        const amountHuman = Number(transformBalance(amount, assetScale));
        return {
          id: id,
          currency: assetCode,
          amount: expect.closeTo(amountHuman, 1),
        };
      });

      expect(
        monetizationCallbackCalls.sort(orderById),
        'amount is sent split equally in each wallet address',
      ).toEqual(expected.sort(orderById));
    });
  });
});
