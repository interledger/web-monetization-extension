import { openDB } from 'idb';
import {
  RateListService,
  matchesPattern,
  hostnameToSiteKey,
  type RateListRecord,
} from '../rateList';
import type { StorageService } from '../storage';
import type { WalletInfo } from '@/shared/types';
import { describe, it, afterEach, vi, expect } from 'vitest';

// IDBKeyRange is not provided by jsdom; shim it for the mock below.
Object.assign(global, {
  IDBKeyRange: { only: (value: unknown) => ({ only: value }) },
});

const mockStore = new Map<string, RateListRecord>();

vi.mock('idb');
const mockedOpenDB = vi.mocked(openDB);

// @ts-expect-error mocking partially only
mockedOpenDB.mockImplementation(async (_name, _v, { upgrade }) => {
  const db = {
    createObjectStore: vi.fn().mockReturnValue({ createIndex: vi.fn() }),
    get: (
      _s: string,
      [ac, as, site]: [assetCode: string, assetScale: number, site: string],
    ) => Promise.resolve(mockStore.get(`${ac}:${as}:${site}`)),
    getAllFromIndex: (
      _s: string,
      _i: string,
      range: { only: [assetCode: string, assetScale: number] },
    ) => {
      const [ac, as] = range.only;
      return Promise.resolve(
        [...mockStore.values()].filter(
          (e) => e.assetCode === ac && e.assetScale === as,
        ),
      );
    },
    put: (_s: string, value: RateListRecord) => {
      mockStore.set(
        `${value.assetCode}:${value.assetScale}:${value.site}`,
        value,
      );
      return Promise.resolve();
    },
    delete: (_s: string, [ac, as, site]: [string, number, string]) => {
      mockStore.delete(`${ac}:${as}:${site}`);
      return Promise.resolve();
    },
    getKeyFromIndex: (
      _s: string,
      _i: string,
      range: { only: [assetCode: string, assetScale: number] },
    ) => {
      const [ac, as] = range.only;
      const entry = [...mockStore.values()].find(
        (e) => e.assetCode === ac && e.assetScale === as,
      );
      return Promise.resolve(
        entry
          ? ([entry.assetCode, entry.assetScale, entry.site] as const)
          : undefined,
      );
    },
    countFromIndex: (
      _s: string,
      _i: string,
      range: { only: [assetCode: string, assetScale: number] },
    ) => {
      const [ac, as] = range.only;
      const count = [...mockStore.values()].filter(
        (e) => e.assetCode === ac && e.assetScale === as,
      ).length;
      return Promise.resolve(count);
    },
  };
  upgrade(db);
  return db;
});

afterEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
});

type Wallet = Pick<WalletInfo, 'assetCode' | 'assetScale'>;
function makeRateListService(
  wallet: Wallet | null = { assetCode: 'USD', assetScale: 2 },
): RateListService {
  const storage = {
    get: vi.fn().mockResolvedValue({ walletAddress: wallet }),
  } as unknown as StorageService;
  return new RateListService({ storage });
}

describe('RateListService CRUD', () => {
  it('setRate and getAll', async () => {
    const rateList = makeRateListService();
    await expect(rateList.isEmpty()).resolves.toBe(true);
    await expect(rateList.count()).resolves.toBe(0);

    await rateList.setRate('example.com', '3');
    await rateList.setRate('other.com', '5');
    await expect(rateList.isEmpty()).resolves.toBe(false);
    await expect(rateList.getAll()).resolves.toEqual(
      expect.arrayContaining([
        { site: '*.example.com', rate: '3' },
        { site: '*.other.com', rate: '5' },
      ]),
    );
    await expect(rateList.count()).resolves.toBe(2);
  });

  it('setRate overwrites an existing entry', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('example.com', '3');
    await rateList.setRate('example.com', '10');
    const all = await rateList.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].rate).toBe('10');
    await expect(rateList.count()).resolves.toBe(1);
  });

  it('deleteRate removes the entry', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('example.com', '3');
    await rateList.deleteRate('example.com');
    await expect(rateList.getAll()).resolves.toHaveLength(0);
    await expect(rateList.isEmpty()).resolves.toBe(true);
  });

  it('getAll throws with no wallet connected', async () => {
    await expect(makeRateListService(null).getAll()).rejects.toThrow(
      'connected wallet',
    );
  });

  it('setRate throws with no wallet connected', async () => {
    await expect(
      makeRateListService(null).setRate('example.com', '3'),
    ).rejects.toThrow('connected wallet');
  });

  it('getAll strips assetCode/assetScale from returned entries', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('example.com', '3');
    const [entry] = await rateList.getAll();
    expect(entry).toEqual({ site: '*.example.com', rate: '3' });
    expect(entry).not.toHaveProperty('assetCode');
    expect(entry).not.toHaveProperty('assetScale');
  });
});

describe('RateListService.getRateForHostname', () => {
  it('undefined when no entries match', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('other.com', '5');
    await expect(
      rateList.getRateForHostname('example.com'),
    ).resolves.toBeUndefined();
  });

  it('throws with no wallet connected', async () => {
    await expect(
      makeRateListService(null).getRateForHostname('example.com'),
    ).rejects.toThrow('connected wallet');
  });

  it('wildcard matches the apex domain', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('example.com', '3');
    await expect(rateList.getRateForHostname('example.com')).resolves.toBe('3');
  });

  it('wildcard matches a direct subdomain', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('example.com', '3');
    await expect(rateList.getRateForHostname('www.example.com')).resolves.toBe(
      '3',
    );
    await expect(rateList.getRateForHostname('blog.example.com')).resolves.toBe(
      '3',
    );
  });

  it('wildcard matches a deep subdomain', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('example.com', '3');
    await expect(rateList.getRateForHostname('a.b.example.com')).resolves.toBe(
      '3',
    );
  });

  it('more-specific wildcard takes priority over less-specific', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('example.com', '3');
    await rateList.setRate('sub.example.com', '7');
    await expect(
      rateList.getRateForHostname('deep.sub.example.com'),
    ).resolves.toBe('7');
    await expect(rateList.getRateForHostname('sub.example.com')).resolves.toBe(
      '7',
    );
    await expect(
      rateList.getRateForHostname('other.example.com'),
    ).resolves.toBe('3');
  });
});

describe('RateListService per-site priority and deletion', () => {
  it('more-specific subdomain rate takes priority over apex rate', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('hostname.com', '3');
    await rateList.setRate('test.hostname.com', '7');
    await expect(
      rateList.getRateForHostname('test.hostname.com'),
    ).resolves.toBe('7');
    await expect(
      rateList.getRateForHostname('deep.test.hostname.com'),
    ).resolves.toBe('7');
    await expect(
      rateList.getRateForHostname('other.hostname.com'),
    ).resolves.toBe('3');
  });

  it('insertion order does not affect priority', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('test.hostname.com', '7');
    await rateList.setRate('hostname.com', '3');
    await expect(
      rateList.getRateForHostname('test.hostname.com'),
    ).resolves.toBe('7');
    await expect(
      rateList.getRateForHostname('other.hostname.com'),
    ).resolves.toBe('3');
  });

  it('deleting the specific rate falls back to the apex rate', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('hostname.com', '3');
    await rateList.setRate('test.hostname.com', '7');
    await rateList.deleteRate('test.hostname.com');
    await expect(
      rateList.getRateForHostname('test.hostname.com'),
    ).resolves.toBe('3');
    await expect(
      rateList.getRateForHostname('other.hostname.com'),
    ).resolves.toBe('3');
  });

  it('deleting the apex rate leaves only the specific rate active', async () => {
    const rateList = makeRateListService();
    await rateList.setRate('hostname.com', '3');
    await rateList.setRate('test.hostname.com', '7');
    await rateList.deleteRate('hostname.com');
    await expect(
      rateList.getRateForHostname('test.hostname.com'),
    ).resolves.toBe('7');
    await expect(
      rateList.getRateForHostname('other.hostname.com'),
    ).resolves.toBeUndefined();
  });
});

describe('RateListService currency isolation', () => {
  it('different currency+scale combinations use separate entries', async () => {
    const usd = makeRateListService({ assetCode: 'USD', assetScale: 2 });
    const eur = makeRateListService({ assetCode: 'EUR', assetScale: 2 });

    await usd.setRate('example.com', '3');
    await eur.setRate('example.com', '5');

    await expect(usd.getRateForHostname('example.com')).resolves.toBe('3');
    await expect(eur.getRateForHostname('example.com')).resolves.toBe('5');
  });

  it('getAll only returns entries for the connected wallet currency', async () => {
    const usd = makeRateListService({ assetCode: 'USD', assetScale: 2 });
    const eur = makeRateListService({ assetCode: 'EUR', assetScale: 2 });

    await usd.setRate('example.com', '3');
    await eur.setRate('other.com', '5');

    const usdAll = await usd.getAll();
    expect(usdAll).toHaveLength(1);
    expect(usdAll[0].site).toBe('*.example.com');
  });

  it('reconnecting with the same currency reuses existing data', async () => {
    const rateList1 = makeRateListService({ assetCode: 'USD', assetScale: 2 });
    await rateList1.setRate('example.com', '3');

    const rateList2 = makeRateListService({ assetCode: 'USD', assetScale: 2 });
    await expect(rateList2.getRateForHostname('example.com')).resolves.toBe(
      '3',
    );
  });
});

describe('hostnameToSiteKey', () => {
  it('maps www to the apex wildcard', () => {
    expect(hostnameToSiteKey('www.example.com')).toBe('*.example.com');
  });

  it('maps an apex domain to its own wildcard', () => {
    expect(hostnameToSiteKey('example.com')).toBe('*.example.com');
  });

  it('maps other subdomains to their own wildcard', () => {
    expect(hostnameToSiteKey('blog.example.com')).toBe('*.blog.example.com');
    expect(hostnameToSiteKey('sub.example.com')).toBe('*.sub.example.com');
    expect(hostnameToSiteKey('deep.sub.example.com')).toBe(
      '*.deep.sub.example.com',
    );
  });
});

describe('matchesPattern', () => {
  it('* matches any hostname', () => {
    expect(matchesPattern('example.com', '*')).toBe(true);
    expect(matchesPattern('www.example.com', '*')).toBe(true);
  });

  it('exact pattern matches only that hostname', () => {
    expect(matchesPattern('example.com', 'example.com')).toBe(true);
    expect(matchesPattern('www.example.com', 'example.com')).toBe(false);
    expect(matchesPattern('example.com', 'www.example.com')).toBe(false);
  });

  it('*.example.com matches the apex domain', () => {
    expect(matchesPattern('example.com', '*.example.com')).toBe(true);
  });

  it('*.example.com matches direct subdomains', () => {
    expect(matchesPattern('www.example.com', '*.example.com')).toBe(true);
    expect(matchesPattern('blog.example.com', '*.example.com')).toBe(true);
  });

  it('*.example.com matches deep subdomains', () => {
    expect(matchesPattern('a.b.example.com', '*.example.com')).toBe(true);
  });

  it('*.example.com does not match unrelated domains', () => {
    expect(matchesPattern('not-example.com', '*.example.com')).toBe(false);
    expect(matchesPattern('other.com', '*.example.com')).toBe(false);
    expect(matchesPattern('myexample.com', '*.example.com')).toBe(false);
  });

  it('*.sub.example.com matches sub.example.com and its subdomains', () => {
    expect(matchesPattern('sub.example.com', '*.sub.example.com')).toBe(true);
    expect(matchesPattern('deep.sub.example.com', '*.sub.example.com')).toBe(
      true,
    );
    expect(matchesPattern('example.com', '*.sub.example.com')).toBe(false);
    expect(matchesPattern('other.example.com', '*.sub.example.com')).toBe(
      false,
    );
  });
});
