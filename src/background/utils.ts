import type {
  AmountValue,
  GrantDetails,
  Tab,
  WalletAmount,
} from '@/shared/types';
import type { Browser, Runtime } from 'webextension-polyfill';
import { EXCHANGE_RATES_URL } from './config';
import { INTERNAL_PAGE_URL_PROTOCOLS, NEW_TAB_PAGES } from './constants';
import { notNullOrUndef } from '@/shared/helpers';
import type { WalletAddress } from '@interledger/open-payments';

export enum GrantResult {
  GRANT_SUCCESS = 'grant_success',
  GRANT_ERROR = 'grant_error',
  KEY_ADD_SUCCESS = 'key_add_success',
  KEY_ADD_ERROR = 'key_add_error',
}

export enum InteractionIntent {
  CONNECT = 'connect',
  RECONNECT = 'reconnect',
  FUNDS = 'funds',
  UPDATE_BUDGET = 'update_budget',
}

export enum ErrorCode {
  CONTINUATION_FAILED = 'continuation_failed',
  HASH_FAILED = 'hash_failed',
  KEY_ADD_FAILED = 'key_add_failed',
}

export const getCurrentActiveTab = async (browser: Browser) => {
  const window = await browser.windows.getLastFocused();
  const activeTabs = await browser.tabs.query({
    active: true,
    windowId: window.id,
  });
  return activeTabs[0];
};

interface ToAmountParams {
  value: string;
  recurring: boolean;
  assetScale: number;
}

export const toAmount = ({
  value,
  recurring,
  assetScale,
}: ToAmountParams): WalletAmount => {
  const interval = `R/${new Date().toISOString()}/P1M`;

  return {
    value: Math.floor(Number.parseFloat(value) * 10 ** assetScale).toString(),
    ...(recurring ? { interval } : {}),
  };
};

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
}

export const getExchangeRates = async (): Promise<ExchangeRates> => {
  const response = await fetch(EXCHANGE_RATES_URL);
  if (!response.ok) {
    throw new Error(
      `Could not fetch exchange rates. [Status code: ${response.status}]`,
    );
  }
  const rates = await response.json();
  if (!rates.base || !rates.rates) {
    throw new Error('Invalid rates format');
  }

  return rates;
};

export const getExchangeRate = (
  rates: ExchangeRates,
  forAssetCode: string,
  fromAssetCode = 'USD',
) => {
  if (!Number.isFinite(rates.rates[forAssetCode])) {
    throw new Error(`Exchange rate for ${forAssetCode} not found.`);
  }

  if (rates.base === fromAssetCode) {
    return rates.rates[forAssetCode];
  }

  return rates.rates[forAssetCode] / rates.rates[fromAssetCode];
};

export const convertWithExchangeRate = <T extends AmountValue | bigint>(
  amount: T,
  from: Pick<WalletAddress, 'assetScale' | 'assetCode'>,
  to: Pick<WalletAddress, 'assetScale' | 'assetCode'>,
  exchangeRates: ExchangeRates,
): T => {
  const exchangeRate = getExchangeRate(
    exchangeRates,
    to.assetCode,
    from.assetCode,
  );

  const scaleDiff = from.assetScale - to.assetScale;
  const scaledExchangeRate = exchangeRate * 10 ** scaleDiff;

  const converted = BigInt(Math.ceil(Number(amount) / scaledExchangeRate));

  return typeof amount === 'string'
    ? (converted.toString() as T)
    : (converted as T);
};

export const getTabId = (sender: Runtime.MessageSender): number => {
  return notNullOrUndef(notNullOrUndef(sender.tab, 'sender.tab').id, 'tab.id');
};

export const getTab = (sender: Runtime.MessageSender): Tab => {
  return notNullOrUndef(notNullOrUndef(sender.tab, 'sender.tab'), 'tab') as Tab;
};

export const redirectToWelcomeScreen = async (
  browser: Browser,
  tabId: number,
  result: GrantResult,
  intent: InteractionIntent,
  errorCode?: ErrorCode,
): Promise<void> => {
  const { OPEN_PAYMENTS_REDIRECT_URL } = await import('@/shared/defines');
  const url = new URL(OPEN_PAYMENTS_REDIRECT_URL);
  url.searchParams.set('result', result);
  url.searchParams.set('intent', intent);
  if (errorCode) url.searchParams.set('errorCode', errorCode);

  await browser.tabs.update(tabId, {
    url: url.toString(),
  });
};

export const ensureTabExists = async (browser: Browser): Promise<number> => {
  const tab = await browser.tabs.create({});
  if (!tab.id) {
    throw new Error('Could not create tab');
  }
  return tab.id;
};

export const reuseOrCreateTab = async (
  browser: Browser,
  url: string,
  tabId?: number,
): Promise<Tab> => {
  try {
    let tab = await browser.tabs.get(tabId ?? -1);
    if (!tab.id) {
      throw new Error('Could not retrieve tab.');
    }
    tab = await browser.tabs.update(tab.id, { url });
    return tab as Tab;
  } catch {
    const tab = await browser.tabs.create({ url });
    if (!tab.id) {
      throw new Error('Newly created tab does not have the id property set.');
    }
    return tab as Tab;
  }
};

export const getSender = (sender: Runtime.MessageSender) => {
  const tabId = getTabId(sender);
  const frameId = notNullOrUndef(sender.frameId, 'sender.frameId');

  return { tabId, frameId, url: sender.url };
};

export const isBrowserInternalPage = (url: URL) => {
  return INTERNAL_PAGE_URL_PROTOCOLS.has(url.protocol);
};

export const isBrowserNewTabPage = (url: URL) => {
  return NEW_TAB_PAGES.some((e) => url.href.startsWith(e));
};

export const computeRate = (rate: string, sessionsCount: number): AmountValue =>
  (BigInt(rate) / BigInt(sessionsCount)).toString();

export function computeBalance(
  grant?: GrantDetails | null,
  grantSpentAmount?: AmountValue | null,
) {
  if (!grant?.amount) return 0n;
  const total = BigInt(grant.amount.value);
  return grantSpentAmount ? total - BigInt(grantSpentAmount) : total;
}

// USD Scale 9 (connected wallet)
// EUR Scale 2 (page)
// MIN_SEND_AMOUNT = 0.01 EUR * 10 ** (9 (Scale) - 2 (scale))
export function* getNextSendableAmount(
  senderAssetScale: number,
  receiverAssetScale: number,
  amount = 0n,
): Generator<AmountValue, never, never> {
  const EXPONENTIAL_INCREASE = 0.5;

  const scaleDiff =
    senderAssetScale < receiverAssetScale
      ? 0
      : senderAssetScale - receiverAssetScale;
  const base = 1n * 10n ** BigInt(scaleDiff);

  if (amount) {
    yield amount.toString();
  }

  let exp = 0;
  while (true) {
    // biome-ignore lint/style/noParameterAssign: it's ok
    amount += base * BigInt(Math.floor(Math.exp(exp)));
    yield amount.toString();
    exp += EXPONENTIAL_INCREASE;
  }
}
