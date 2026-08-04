import { vi } from 'vitest';
import type { Browser, Tabs } from 'webextension-polyfill';
import type { Storage, WalletInfo } from '@/shared/types';

export const walletInfo: WalletInfo = {
  id: 'https://wallet.example/alice',
  url: 'https://wallet.example/alice',
  assetCode: 'USD',
  assetScale: 2,
  authServer: 'https://wallet.example',
  resourceServer: 'https://wallet.example',
};

export const makeWallet = (overrides?: Partial<WalletInfo>) => ({
  ...walletInfo,
  ...overrides,
});

export const makeLogger = () => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
});

// wraps a real Browser method's own param types with a relaxed (partial)
// resolved value, so tests can pass minimal tab/window fixtures
type MockedAsync<Method extends (...args: never[]) => Promise<unknown>> = (
  ...args: Parameters<Method>
) => Promise<Partial<Awaited<ReturnType<Method>>>>;

// same, but also allows resolving `undefined` for a "not found" lookup
type MockedAsyncOptional<
  Method extends (...args: never[]) => Promise<unknown>,
> = (
  ...args: Parameters<Method>
) => Promise<Partial<Awaited<ReturnType<Method>>> | undefined>;

export const makeBrowser = () => ({
  alarms: {
    onAlarm: { addListener: vi.fn() },
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    clear: vi.fn(),
  },
  runtime: {
    getURL: vi.fn<Browser['runtime']['getURL']>(
      (path) => `chrome-extension://ext-id/${path}`,
    ),
    onConnect: {
      addListener: vi.fn<Browser['runtime']['onConnect']['addListener']>(),
      removeListener:
        vi.fn<Browser['runtime']['onConnect']['removeListener']>(),
    },
  },
  windows: {
    getLastFocused: vi
      .fn<MockedAsync<Browser['windows']['getLastFocused']>>()
      .mockResolvedValue({ id: 1 }),
  },

  tabs: {
    query: vi
      .fn<
        (
          ...args: Parameters<Browser['tabs']['query']>
        ) => Promise<Partial<Tabs.Tab>[]>
      >()
      .mockResolvedValue([]),
    get: vi
      .fn<MockedAsyncOptional<Browser['tabs']['get']>>()
      .mockResolvedValue(undefined),
    update: vi
      .fn<MockedAsync<Browser['tabs']['update']>>()
      .mockResolvedValue({}),
    create: vi
      .fn<MockedAsync<Browser['tabs']['create']>>()
      .mockResolvedValue({ id: 1 }),
    remove: vi.fn<Browser['tabs']['remove']>().mockResolvedValue(undefined),
    highlight: vi
      .fn<MockedAsync<Browser['tabs']['highlight']>>()
      .mockResolvedValue({}),
  },
});

// the fake above only implements the slice of Browser each test needs
export type FakeBrowser = ReturnType<typeof makeBrowser>;
export const asBrowser = (browser: FakeBrowser) =>
  browser as unknown as Browser;

export const makeStorage = (initial: Partial<Storage> = {}) => {
  const state: Partial<Storage> = { ...initial };

  return {
    get: vi.fn(async (keys?: (keyof Storage)[]) => {
      const result: Record<string, unknown> = {};
      for (const key of keys ?? []) result[key] = state[key];
      return result;
    }),
    set: vi.fn(async (data: Partial<Storage>) => {
      Object.assign(state, data);
    }),
    setSpentAmount: vi.fn(
      async (grant: 'recurring' | 'one-time', amount: string) => {
        if (grant === 'recurring') state.recurringGrantSpentAmount = amount;
        else state.oneTimeGrantSpentAmount = amount;
      },
    ),
  };
};
