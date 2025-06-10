import type { WalletAddress, JWKS } from '@interledger/open-payments';
import type { GetConnectWalletAddressInfoResponse } from '@/shared/messages';
import type { AmountValue } from '@/shared/types';
import {
  convertWithExchangeRate,
  getBudgetRecommendationsData,
  getExchangeRatesMemoized,
} from '@/background/utils';
import { ensureEnd } from './misc';
import { transformBalance } from './currency';

export function toWalletAddressUrl(s: string): string {
  return s.startsWith('$') ? s.replace('$', 'https://') : s;
}

const isWalletAddress = (o: Record<string, unknown>): o is WalletAddress => {
  return !!(
    o.id &&
    typeof o.id === 'string' &&
    o.assetScale &&
    typeof o.assetScale === 'number' &&
    o.assetCode &&
    typeof o.assetCode === 'string' &&
    o.authServer &&
    typeof o.authServer === 'string' &&
    o.resourceServer &&
    typeof o.resourceServer === 'string'
  );
};

export const getWalletInformation = async (
  walletAddressUrl: string,
): Promise<WalletAddress> => {
  const response = await fetch(walletAddressUrl, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('This wallet address does not exist.');
    }
    throw new Error('Failed to fetch wallet address.');
  }

  const msgInvalidWalletAddress = 'Provided URL is not a valid wallet address.';
  const json = await response.json().catch((error) => {
    throw new Error(msgInvalidWalletAddress, { cause: error });
  });
  if (!isWalletAddress(json)) {
    throw new Error(msgInvalidWalletAddress);
  }

  return json;
};

export const getConnectWalletAddressInfo = async (
  walletAddressUrl: string,
): Promise<GetConnectWalletAddressInfoResponse> => {
  const walletAddress = await getWalletInformation(
    toWalletAddressUrl(walletAddressUrl),
  );
  const budgetData = await getBudgetRecommendationsData();

  if (Object.hasOwn(budgetData, walletAddress.assetCode)) {
    const { assetCode, assetScale } = walletAddress;
    const { budget, hourly } = budgetData[assetCode];
    const defaultRateOfPay = Number(hourly.default) * 10 ** assetScale;
    return {
      walletAddress,
      defaultBudget: budget.default,
      defaultRateOfPay: defaultRateOfPay.toFixed(0),
    };
  }

  const exchangeRates = await getExchangeRatesMemoized();
  const convert = (amount: AmountValue): AmountValue => {
    const src = { assetCode: 'USD', assetScale: 2 };
    return convertWithExchangeRate(amount, src, walletAddress, exchangeRates);
  };
  const defaultBudget = convert('5000');
  const defaultRateOfPay = convert('60');
  return {
    walletAddress,
    defaultBudget: Number(
      transformBalance(defaultBudget, walletAddress.assetScale),
    ),
    defaultRateOfPay,
  };
};

export const getJWKS = async (walletAddressUrl: string) => {
  const jwksUrl = new URL('jwks.json', ensureEnd(walletAddressUrl, '/'));
  const res = await fetch(jwksUrl.href);
  const json = await res.json();
  return json as JWKS;
};
