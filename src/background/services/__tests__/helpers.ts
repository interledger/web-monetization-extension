import { vi } from 'vitest';
import { StorageService } from '../storage';

export const walletInfo = {
  id: 'https://wallet.example/alice',
  url: 'https://wallet.example/alice',
  assetCode: 'USD',
  assetScale: 2,
  authServer: 'https://wallet.example',
  resourceServer: 'https://wallet.example',
};

export const makeLogger = () => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
});

export const makeBrowser = () => ({
  alarms: {
    onAlarm: { addListener: vi.fn() },
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    clear: vi.fn(),
  },
  runtime: {
    onConnect: { addListener: vi.fn(), removeListener: vi.fn() },
  },
});

export const makeStorage = (initial: Partial<Storage> = {}) : StorageService => {
  const state: Partial<Storage> = { ...initial };

  return {
    state,
    get: vi.fn(async (keys: (keyof Storage)[]) => {
      const result: Record<string, unknown> = {};
      for (const key of keys) result[key] = state[key];
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
