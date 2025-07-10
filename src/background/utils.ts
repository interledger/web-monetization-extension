import type {
  AmountValue,
  GrantDetails,
  Tab,
  TabId,
  WalletAmount,
} from '@/shared/types';
import type { Browser, Runtime, Tabs } from 'webextension-polyfill';
import { BACKGROUND_TO_POPUP_CONNECTION_NAME } from '@/shared/messages';
import { EXCHANGE_RATES_URL } from './config';
import { INTERNAL_PAGE_URL_PROTOCOLS, NEW_TAB_PAGES } from './constants';
import { memoize, notNullOrUndef } from '@/shared/helpers';
import type { WalletAddress } from '@interledger/open-payments';

type OnConnectCallback = Parameters<
  Browser['runtime']['onConnect']['addListener']
>[0];

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
  TIMEOUT = 'timeout',
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

export function bigIntMax<T extends bigint | AmountValue>(a: T, b: T): T {
  return BigInt(a) > BigInt(b) ? a : b;
}

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
}

export const getExchangeRates = memoize(
  async (): Promise<ExchangeRates> => {
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
  },
  { maxAge: 15 * 60 * 1000, mechanism: 'stale-while-revalidate' },
);

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

  const converted = BigInt(Math.round(Number(amount) / scaledExchangeRate));

  return typeof amount === 'string'
    ? (converted.toString() as T)
    : (converted as T);
};

// https://interledger.github.io/web-monetization-budget-suggestions/v1/schema.json
type BudgetRecommendationsDataSchema = {
  [currency: string]: {
    budget: { default: number; max: number };
    hourly: { default: number; max: number };
  };
};

export const getBudgetRecommendationsData = memoize(
  async () => {
    const { BUDGET_RECOMMENDATIONS_URL } = await import('@/background/config');
    const response = await fetch(BUDGET_RECOMMENDATIONS_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch budget recommendations data.');
    }
    const data: BudgetRecommendationsDataSchema = await response.json();
    return data;
  },
  { maxAge: 30 * 60 * 1000, mechanism: 'stale-while-revalidate' },
);

export function convert(value: bigint, source: number, target: number) {
  const scaleDiff = target - source;
  if (scaleDiff > 0) {
    return value * BigInt(10 ** scaleDiff);
  }
  return value / BigInt(10 ** -scaleDiff);
}

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

export const closeTabsByFilter = async (
  browser: Browser,
  filter: (tab: Tabs.Tab) => boolean | undefined,
) => {
  const tabs = await browser.tabs.query({ lastFocusedWindow: true });
  await Promise.all(
    tabs.filter(filter).map((tab) => browser.tabs.remove(tab.id!)),
  );
};

export const createTab = async (
  browser: Browser,
  url?: string,
): Promise<TabId> => {
  const tab = await browser.tabs.create({ url });
  return tab.id!;
};

export const createTabIfNotExists = async (
  browser: Browser,
  tabId?: TabId,
  url?: string,
): Promise<TabId> => {
  if (!tabId) return createTab(browser, url);
  try {
    await browser.tabs.get(tabId);
    if (url) await browser.tabs.update(tabId, { url });
    return tabId;
  } catch {
    return createTab(browser, url);
  }
};

export const onPopupOpen = (
  browser: Browser,
  callback: () => Promise<void>,
) => {
  const listener: OnConnectCallback = (port) => {
    if (port.name !== BACKGROUND_TO_POPUP_CONNECTION_NAME) return;
    if (port.error) return;

    void callback();
  };

  browser.runtime.onConnect.addListener(listener);
  return () => {
    browser.runtime.onConnect.removeListener(listener);
  };
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

export function isSecureContext(url: string | URL) {
  const { hostname, protocol } = new URL(url);
  if (protocol === 'https:') return true;
  return (
    hostname === 'localhost' ||
    // Let localhost be localhost
    hostname.endsWith('.localhost') ||
    // even though it's 127.0.0.0/8, 127.0.0.1 should be ok as most common case
    hostname === '127.0.0.1'
  );
}

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
