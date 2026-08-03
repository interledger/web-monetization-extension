// @vitest-environment node
// cSpell:ignore newtab, unstub
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest';

import type { Browser, Runtime, Tabs } from 'webextension-polyfill';

import type { GrantDetails } from '@/shared/types';
import { BACKGROUND_TO_POPUP_CONNECTION_NAME } from '@/shared/messages';
import {
  bigIntMax,
  closeTabsByFilter,
  computeBalance,
  computeRate,
  convert,
  convertWithExchangeRate,
  createTab,
  createTabIfNotExists,
  dedupe,
  getAppUrl,
  getCurrentActiveTab,
  getExchangeRate,
  getJWKS,
  getNextSendableAmount,
  getSender,
  getTab,
  getTabId,
  getWalletInformation,
  highlightTab,
  isAbortSignalTimeout,
  isBrowserInternalPage,
  isBrowserNewTabPage,
  isKeyAddedToWallet,
  isOkState,
  isSecureContext,
  isTabWithUrl,
  onPopupOpen,
  openAppPage,
  redirectToPostConnect,
  removeQueryParams,
  Timeout,
  toAmount,
  WalletStatusCancelError,
  WalletStatusFailureError,
} from './utils';
import { makeWallet } from './services/__tests__/helpers';

// same as BuiltinIterator.take(n)
function take<T>(iter: IterableIterator<T>, n: number) {
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    const item = iter.next();
    if (item.done) break;
    result.push(item.value);
  }
  return result;
}

describe('getNextSendableAmount', () => {
  it('from assetScale 8 to 9', () => {
    const min = 990_00_000n / 3600n; // 0.99XPR per hour == 0.000275 XRP per second (27500 at scale 8)
    expect(take(getNextSendableAmount(8, 9, min), 8)).toEqual([
      '27500',
      '27501',
      '27502',
      '27504',
      '27508',
      '27515',
      '27527',
      '27547',
    ]);
  });

  it('from assetScale 8 to 2', () => {
    const min = 990_00_000n / 3600n;
    expect(take(getNextSendableAmount(8, 2, min), 8)).toEqual([
      '27500',
      '1027500',
      '2027500',
      '4027500',
      '8027500',
      '15027500',
      '27027500',
      '47027500',
    ]);
  });

  it('from assetScale 3 to 2', () => {
    expect(take(getNextSendableAmount(3, 2), 8)).toEqual([
      '10',
      '20',
      '40',
      '80',
      '150',
      '270',
      '470',
      '800',
    ]);
  });

  it('from assetScale 2 to 3', () => {
    expect(take(getNextSendableAmount(2, 3), 8)).toEqual([
      '1',
      '2',
      '4',
      '8',
      '15',
      '27',
      '47',
      '80',
    ]);
  });

  it('from assetScale 2 to 2', () => {
    expect(take(getNextSendableAmount(2, 2), 8)).toEqual([
      '1',
      '2',
      '4',
      '8',
      '15',
      '27',
      '47',
      '80',
    ]);
  });
});

describe('convertWithExchangeRate', () => {
  const exchangeRates = {
    base: 'USD',
    rates: {
      BTC: 96_048.49, // very large rate
      CAD: 0.7, // close rate, lower
      EUR: 1.04, // close rate, larger; common case
      GBP: 1.24,
      JPY: 0.0065, // small rate, different assetScale?
      LTC: 117.04, // large-ish rate
      MXN: 0.0486, // common case
      RON: 0.21,
      SHIB: 0.000_015_89, // very small rate
      USD: 1, // base, very common case
      ZAR: 0.05, // small rate; common case
    },
  };

  const CASES = [
    {
      name: 'between same currency',
      from: 'USD',
      to: 'USD',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '10' },
        { input: '100', expected: '100' },
        { input: '10000', expected: '10000' },
        { input: '15', expected: '15' },
        { input: '2', expected: '2' },
        { input: '200', expected: '200' },
        { input: 200n, expected: 200n },
      ],
    },
    {
      name: 'from weaker currency',
      from: 'USD',
      to: 'GBP',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '8' },
        { input: '100', expected: '81' },
        { input: '10000', expected: '8065' },
        { input: '15', expected: '12' },
        { input: '2', expected: '2' },
        { input: '200', expected: '161' },
      ],
    },
    {
      name: 'from slightly weaker currency',
      from: 'USD',
      to: 'EUR',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '10' },
        { input: '100', expected: '96' },
        { input: '10000', expected: '9615' },
        { input: '15', expected: '14' },
        { input: '2', expected: '2' },
        { input: '200', expected: '192' },
        { input: 200n, expected: 192n },
      ],
    },
    {
      name: 'from stronger currency',
      from: 'USD',
      to: 'MXN',
      amounts: [
        { input: '1', expected: '21' },
        { input: '10', expected: '206' },
        { input: '100', expected: '2058' },
        { input: '10000', expected: '205761' },
        { input: '15', expected: '309' },
        { input: '2', expected: '41' },
        { input: '200', expected: '4115' },
        { input: 200n, expected: 4115n },
      ],
    },
    {
      name: 'from much stronger currency',
      from: 'USD',
      to: 'ZAR',
      amounts: [
        { input: '1', expected: '20' },
        { input: '10', expected: '200' },
        { input: '100', expected: '2000' },
        { input: '10000', expected: '200000' },
        { input: '15', expected: '300' },
        { input: '2', expected: '40' },
        { input: '200', expected: '4000' },
        { input: 200n, expected: 4000n },
      ],
    },
    {
      name: 'with different base currency',
      from: 'GBP',
      to: 'USD',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '12' },
        { input: '100', expected: '124' },
        { input: '10000', expected: '12400' },
        { input: '15', expected: '19' },
        { input: '2', expected: '2' },
        { input: '200', expected: '248' },
      ],
    },
    {
      name: 'with different assetScale (2 -> 3)',
      from: 'USD',
      to: 'JPY',
      toAssetScale: 3,
      amounts: [
        { input: '1', expected: '1538' },
        { input: '10', expected: '15385' },
        { input: '100', expected: '153846' },
        { input: '10000', expected: '15384615' },
        { input: '15', expected: '23077' },
        { input: '2', expected: '3077' },
        { input: '200', expected: '307692' },
      ],
    },
  ];

  it.each(CASES)('$name', (testCase) => {
    const from = {
      assetScale: 2,
      assetCode: testCase.from,
    };
    const to = {
      assetScale: testCase.toAssetScale ?? 2,
      assetCode: testCase.to,
    };
    for (const { input, expected } of testCase.amounts) {
      expect(
        convertWithExchangeRate(input, from, to, exchangeRates),
        `input: ${input} ${from.assetCode}, expected: ${expected} ${to.assetCode}`,
      ).toBe(expected);
    }
  });
});

describe('dedupe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    dedupe.clear();
  });

  const createAsyncFn = <T>({
    returnValue,
    timeout = 0,
    shouldReject = false,
    mockFnName = 'mockFn',
  }: {
    returnValue: T;
    timeout?: number;
    shouldReject?: boolean;
    mockFnName?: string;
  }) => {
    const fn = vi.fn(async (..._args: unknown[]) => {
      return new Promise((resolve, reject) => {
        if (shouldReject) {
          return reject(new Error('Test error'));
        }
        setTimeout(() => resolve(returnValue), timeout);
      });
    });
    // dedupe's cache key needs a name, but vi.fn() returns anonymous fn
    Object.defineProperty(fn, 'name', { value: mockFnName });
    return fn;
  };

  it('calls the original function only once for multiple simultaneous calls', async () => {
    const returnValue = { value: 'value' };
    const fn = createAsyncFn({ returnValue, mockFnName: 'basic' });
    const dedupedFn = dedupe(fn);
    const resultPromises = [dedupedFn(), dedupedFn(), dedupedFn()];
    vi.runAllTimers();

    const results = await Promise.all(resultPromises);
    expect(results[0]).toBe(returnValue);
    expect(results[1]).toBe(returnValue);
    expect(results[2]).toBe(returnValue);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not dedupe functions with different names', async () => {
    const returnValue1 = { value: 'value1' };
    const returnValue2 = { value: 'value2' };
    const fn1 = createAsyncFn({
      returnValue: returnValue1,
      timeout: 100,
      mockFnName: 'fn1',
    });
    const fn2 = createAsyncFn({
      returnValue: returnValue2,
      timeout: 400,
      mockFnName: 'fn2',
    });
    const dedupedFn1 = dedupe(fn1);
    const dedupedFn2 = dedupe(fn2);
    const resultPromises = [dedupedFn1('arg1'), dedupedFn2('arg2')];

    vi.runAllTimers();

    const [result1, result2] = await Promise.all(resultPromises);
    expect(result1).toBe(returnValue1);
    expect(result2).toBe(returnValue2);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('dedupes pending calls to the same fn regardless of arguments', async () => {
    const returnValue = { value: 'value' };
    const fn = createAsyncFn({
      returnValue,
      timeout: 100,
      mockFnName: 'sameNameDifferentArgs',
    });
    const dedupedFn = dedupe(fn);

    const result1 = dedupedFn(1, { key: 'arg1' });
    // at this point, result1's promise is still pending, so result2/result3
    // reuse it even though the arguments differ
    const result2 = dedupedFn({ key: 'arg2' }, 2);
    const result3 = dedupedFn({ key: 'arg3' }, 3);
    vi.runAllTimers();

    await expect(result1).resolves.toBe(returnValue);
    await expect(result2).resolves.toBe(returnValue);
    await expect(result3).resolves.toBe(returnValue);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not cache rejections by default', async () => {
    const fn = createAsyncFn({
      returnValue: { value: 'value' },
      shouldReject: true,
      mockFnName: 'rejectsByDefault',
    });
    const dedupedFn = dedupe(fn);

    const result1 = dedupedFn(1, { key: 'value' });
    await expect(result1).rejects.toThrow('Test error');
    // since the rejection wasn't cached, this re-invokes the original fn
    const result2 = dedupedFn(1, { key: 'value' });
    await expect(result2).rejects.toThrow('Test error');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shares a pending promise even if it eventually rejects', async () => {
    const fn = createAsyncFn({
      returnValue: { value: 'value' },
      shouldReject: true,
      timeout: 500,
      mockFnName: 'pendingRejection',
    });
    const dedupedFn = dedupe(fn);
    const result1 = dedupedFn(1, 2);
    const result2 = dedupedFn(1, 2);
    vi.runAllTimers();

    await expect(result1).rejects.toThrow('Test error');
    await expect(result2).rejects.toThrow('Test error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('caches and reuses rejected promises when cacheRejections is true', async () => {
    const fn = createAsyncFn({
      returnValue: { value: 'value' },
      shouldReject: true,
      mockFnName: 'cacheRejections',
    });
    const dedupedFn = dedupe(fn, { cacheRejections: true });

    const result1 = dedupedFn();
    await expect(result1).rejects.toThrow('Test error');
    const result2 = dedupedFn();
    await expect(result2).rejects.toThrow('Test error');
    await expect(result1).rejects.toBe(await result2.catch((e) => e));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps serving the resolved value from cache until `wait` elapses, then re-invokes', async () => {
    const returnValue = { value: 'value' };
    const fn = createAsyncFn({ returnValue, mockFnName: 'cacheExpiration' });
    const dedupedFn = dedupe(fn, { wait: 5000 });

    const promise1 = dedupedFn();
    await vi.advanceTimersByTimeAsync(0); // let fn's own setTimeout(0) resolve
    expect(await promise1).toBe(returnValue);
    expect(fn).toHaveBeenCalledTimes(1);

    // still within the wait window: served from cache, fn not called again
    expect(await dedupedFn()).toBe(returnValue);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000); // cache-clear timeout fires

    const promise2 = dedupedFn();
    await vi.advanceTimersByTimeAsync(0);
    await promise2;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rejects when the wrapped function has no name', async () => {
    const fn = createAsyncFn({ returnValue: {}, mockFnName: '' });
    const dedupedFn = dedupe(fn);
    await expect(dedupedFn()).rejects.toThrow(
      'Function name is required for caching',
    );
  });
});

describe('isSecureContext', () => {
  it('returns true for https:// URLs', () => {
    expect(isSecureContext('https://example.com')).toBe(true);
    expect(isSecureContext('https://example.com/foo')).toBe(true);

    expect(isSecureContext('https://localhost')).toBe(true);
    expect(isSecureContext('https://localhost:4000')).toBe(true);

    expect(isSecureContext('https://127.0.0.1')).toBe(true);
    expect(isSecureContext('https://127.0.0.1:3000')).toBe(true);
  });

  it('returns true for localhost URLs', () => {
    expect(isSecureContext('http://localhost')).toBe(true);
    expect(isSecureContext('http://localhost:4000')).toBe(true);
    expect(isSecureContext('http://example.localhost')).toBe(true);
    expect(isSecureContext('http://example.localhost:5000')).toBe(true);

    expect(isSecureContext('http://127.0.0.1:3000')).toBe(true);
    expect(isSecureContext('http://127.0.0.1')).toBe(true);
  });

  it('returns false for everything else', () => {
    expect(isSecureContext('http://example.com')).toBe(false);
    expect(isSecureContext('http://example.com/foo')).toBe(false);

    // Not supported for our use case
    expect(isSecureContext('wss://example.com')).toBe(false);
    expect(isSecureContext('file:///users/sid')).toBe(false);
  });
});

describe('removeQueryParams', () => {
  it('should remove the query params from the URL', () => {
    expect(removeQueryParams('https://example.com?foo=bar#baz')).toBe(
      'https://example.com/',
    );
  });

  it('should normalize the URL if there are no query params', () => {
    expect(removeQueryParams('https://example.com')).toBe(
      'https://example.com/',
    );
  });
});

describe('isOkState', () => {
  it('should return true if no state is set', () => {
    expect(isOkState({})).toBe(true);
    expect(
      isOkState({ key_revoked: false, missing_host_permissions: false }),
    ).toBe(true);
  });

  it('should return false if any state is set', () => {
    expect(
      isOkState({ key_revoked: true, missing_host_permissions: false }),
    ).toBe(false);
    expect(
      isOkState({ key_revoked: false, missing_host_permissions: true }),
    ).toBe(false);
  });
});

describe('Timeout', () => {
  vi.useFakeTimers();

  let callback: MockedFunction<() => void>;
  let timeout: Timeout;
  beforeEach(() => {
    callback = vi.fn<() => void>();
    timeout = new Timeout(1000, callback);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should call the callback after the specified time', () => {
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reset the timeout', () => {
    timeout.reset(2000);
    // @ts-expect-error for testing it's ok to access private properties
    expect(timeout.ms).toBe(2000);
    vi.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pause the timeout', () => {
    timeout.pause();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should resume the timeout', () => {
    timeout.pause();
    vi.advanceTimersByTime(500);
    timeout.resume();
    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should clear the timeout', () => {
    timeout.clear();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should throw when resuming a timeout that was never paused', () => {
    expect(() => timeout.resume()).toThrow(
      'Unexpected: Timeout was not paused, cannot resume',
    );
  });

  it('should resume immediately (via reset) if the remaining time already elapsed', () => {
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    timeout.pause();
    timeout.resume();

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not schedule anything when constructed with ms <= 0', () => {
    const cb = vi.fn<() => void>();
    new Timeout(0, cb);
    vi.advanceTimersByTime(10_000);
    expect(cb).not.toHaveBeenCalled();
  });

  it('pausing an already-paused timeout is a no-op', () => {
    timeout.pause();
    timeout.pause();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('bigIntMax', () => {
  it('returns the larger of two bigints', () => {
    expect(bigIntMax(5n, 10n)).toBe(10n);
    expect(bigIntMax(10n, 5n)).toBe(10n);
  });

  it('returns the larger of two numeric strings', () => {
    expect(bigIntMax('5', '10')).toBe('10');
    expect(bigIntMax('10', '5')).toBe('10');
  });

  it('returns either value when they are equal', () => {
    expect(bigIntMax(5n, 5n)).toBe(5n);
  });
});

describe('toAmount', () => {
  it('converts a decimal string value to integer units at the given scale', () => {
    expect(
      toAmount({ value: '1.23', recurring: false, assetScale: 2 }),
    ).toEqual({ value: '123' });
    expect(toAmount({ value: '1', recurring: false, assetScale: 0 })).toEqual({
      value: '1',
    });
  });

  it('floors fractional units beyond the scale', () => {
    expect(
      toAmount({ value: '1.239', recurring: false, assetScale: 2 }),
    ).toEqual({ value: '123' });
  });

  it('omits interval when not recurring', () => {
    const amount = toAmount({ value: '1', recurring: false, assetScale: 2 });
    expect(amount).not.toHaveProperty('interval');
  });

  it('adds a monthly recurring interval starting now when recurring is true', () => {
    const amount = toAmount({ value: '1', recurring: true, assetScale: 2 });
    expect(amount.value).toBe('100');
    expect(amount.interval).toMatch(
      /^R\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\/P1M$/,
    );
  });
});

describe('convert', () => {
  it('scales up when target scale is larger', () => {
    expect(convert(100n, 2, 4)).toBe(10000n);
  });

  it('scales down when target scale is smaller', () => {
    expect(convert(10000n, 4, 2)).toBe(100n);
  });

  it('returns the same value when scales are equal', () => {
    expect(convert(100n, 2, 2)).toBe(100n);
  });
});

describe('computeRate', () => {
  it('divides the rate by the session count', () => {
    expect(computeRate('100', 4)).toBe('25');
  });

  it('truncates towards zero on non-exact division', () => {
    expect(computeRate('10', 3)).toBe('3');
  });
});

describe('computeBalance', () => {
  it('returns 0n when there is no grant', () => {
    expect(computeBalance(null)).toBe(0n);
    expect(computeBalance(undefined)).toBe(0n);
    expect(computeBalance()).toBe(0n);
  });

  it('returns the full grant amount when nothing has been spent', () => {
    const grant = { amount: { value: '1000' } } as unknown as GrantDetails;
    expect(computeBalance(grant)).toBe(1000n);
    expect(computeBalance(grant, null)).toBe(1000n);
  });

  it('subtracts the spent amount from the grant amount', () => {
    const grant = { amount: { value: '1000' } } as unknown as GrantDetails;
    expect(computeBalance(grant, '400')).toBe(600n);
  });
});

describe('isBrowserInternalPage', () => {
  it('returns true for known internal protocols', () => {
    expect(isBrowserInternalPage(new URL('chrome://extensions'))).toBe(true);
    expect(isBrowserInternalPage(new URL('about:blank'))).toBe(true);
    expect(isBrowserInternalPage(new URL('edge://settings'))).toBe(true);
  });

  it('returns false for regular http(s) pages', () => {
    expect(isBrowserInternalPage(new URL('https://example.com'))).toBe(false);
  });
});

describe('isBrowserNewTabPage', () => {
  it('returns true for known new-tab-page URLs', () => {
    expect(isBrowserNewTabPage(new URL('about:blank'))).toBe(true);
    expect(isBrowserNewTabPage(new URL('chrome://newtab'))).toBe(true);
    expect(isBrowserNewTabPage(new URL('chrome://new-tab-page/'))).toBe(true);
  });

  it('returns false for other URLs', () => {
    expect(isBrowserNewTabPage(new URL('https://example.com'))).toBe(false);
    expect(isBrowserNewTabPage(new URL('chrome://extensions'))).toBe(false);
  });
});

describe('getAppUrl', () => {
  it('sets the hash to the given pathname', () => {
    expect(getAppUrl('/connect', 'https://example.com/app.html')).toBe(
      'https://example.com/app.html#/connect',
    );
  });

  it('adds query params before the hash when provided', () => {
    const params = new URLSearchParams({ foo: 'bar' });
    expect(getAppUrl('/connect', 'https://example.com/app.html', params)).toBe(
      'https://example.com/app.html?foo=bar#/connect',
    );
  });
});

describe('isAbortSignalTimeout', () => {
  it('returns true for a TimeoutError DOMException', () => {
    const err = new DOMException('The operation timed out', 'TimeoutError');
    expect(isAbortSignalTimeout(err)).toBe(true);
  });

  it('returns true for the reason produced by a real AbortSignal.timeout()', async () => {
    const signal = AbortSignal.timeout(0);
    const aborted = new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
    vi.advanceTimersByTime(1);
    await aborted;
    expect(isAbortSignalTimeout(signal.reason)).toBe(true);
  });

  it('returns false for other DOMExceptions or errors', () => {
    expect(
      isAbortSignalTimeout(new DOMException('Aborted', 'AbortError')),
    ).toBe(false);
    expect(isAbortSignalTimeout(new Error('nope'))).toBe(false);
    expect(isAbortSignalTimeout(undefined)).toBe(false);
  });
});

describe('isTabWithUrl', () => {
  it('returns true when the tab has both id and url', () => {
    expect(isTabWithUrl({ id: 1, url: 'https://example.com' } as never)).toBe(
      true,
    );
  });

  it('returns false when id or url is missing', () => {
    expect(isTabWithUrl({ url: 'https://example.com' } as never)).toBe(false);
    expect(isTabWithUrl({ id: 1 } as never)).toBe(false);
    expect(isTabWithUrl({} as never)).toBe(false);
  });
});

describe('getExchangeRate', () => {
  const rates = { base: 'USD', rates: { USD: 1, EUR: 1.1, GBP: 1.3 } };

  it('returns the rate directly when converting from the base currency', () => {
    expect(getExchangeRate(rates, 'EUR')).toBe(1.1);
  });

  it('computes a cross rate when converting between two non-base currencies', () => {
    expect(getExchangeRate(rates, 'GBP', 'EUR')).toBeCloseTo(1.3 / 1.1);
  });

  it('throws when the requested asset code has no rate', () => {
    expect(() => getExchangeRate(rates, 'XYZ')).toThrow(/not found/);
  });
});

describe('WalletStatusFailureError', () => {
  it('uses the code as the message and stores details as the cause', () => {
    const err = new WalletStatusFailureError('key_add_failed', {
      details: { message: 'boom' },
    });
    expect(err.message).toBe('key_add_failed');
    expect(err.code).toBe('key_add_failed');
    expect(err.details).toEqual({ message: 'boom' });
    expect(err.cause).toEqual({ message: 'boom' });
  });

  it('allows omitting details', () => {
    const err = new WalletStatusFailureError('timeout');
    expect(err.message).toBe('timeout');
    expect(err.details).toBeUndefined();
  });
});

describe('WalletStatusCancelError', () => {
  it('uses the code as the message', () => {
    const err = new WalletStatusCancelError('tab_closed');
    expect(err.message).toBe('tab_closed');
    expect(err.code).toBe('tab_closed');
  });
});

describe('getWalletInformation', () => {
  const validWalletAddress = {
    id: 'https://wallet.example/alice',
    assetScale: 2,
    assetCode: 'USD',
    authServer: 'https://auth.wallet.example',
    resourceServer: 'https://wallet.example',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns wallet info with the given url on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validWalletAddress),
      }),
    );
    const result = await getWalletInformation('https://wallet.example/alice');
    expect(result).toEqual({
      ...validWalletAddress,
      url: 'https://wallet.example/alice',
    });
  });

  it('throws a not-exist error on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 }),
    );
    await expect(
      getWalletInformation('https://wallet.example/missing'),
    ).rejects.toThrow('This wallet address does not exist.');
  });

  it('throws a generic error for other failed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    await expect(
      getWalletInformation('https://wallet.example/alice'),
    ).rejects.toThrow('Failed to fetch wallet address.');
  });

  it('throws when the response is not a valid wallet address', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ foo: 'bar' }),
      }),
    );
    await expect(
      getWalletInformation('https://wallet.example/alice'),
    ).rejects.toThrow('Provided URL is not a valid wallet address.');
  });

  it('wraps a JSON-parsing failure as an invalid-wallet-address error', async () => {
    const cause = new Error('Unexpected token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(cause),
      }),
    );
    await expect(
      getWalletInformation('https://wallet.example/alice'),
    ).rejects.toMatchObject({
      message: 'Provided URL is not a valid wallet address.',
      cause,
    });
  });
});

describe('getJWKS', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves jwks.json relative to the wallet address path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve({ keys: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const result = await getJWKS('https://wallet.example/alice');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://wallet.example/alice/jwks.json',
    );
    expect(result).toEqual({ keys: [] });
  });

  it('adds a trailing slash before resolving when missing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ json: () => Promise.resolve({ keys: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await getJWKS('https://wallet.example');
    expect(fetchMock).toHaveBeenCalledWith('https://wallet.example/jwks.json');
  });
});

describe('isKeyAddedToWallet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the kid is present in the jwks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({ keys: [{ kid: 'key-1' }, { kid: 'key-2' }] }),
      }),
    );
    await expect(
      isKeyAddedToWallet('https://wallet.example/alice', 'key-2'),
    ).resolves.toBe(true);
  });

  it('returns false when the kid is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ keys: [{ kid: 'key-1' }] }),
      }),
    );
    await expect(
      isKeyAddedToWallet('https://wallet.example/alice', 'key-2'),
    ).resolves.toBe(false);
  });
});

describe('getExchangeRates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetches and returns exchange rates, hardcoding MMAON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ base: 'USD', rates: { EUR: 1.1 } }),
      }),
    );
    const { getExchangeRates } = await import('./utils');
    const rates = await getExchangeRates();
    expect(rates).toEqual({ base: 'USD', rates: { EUR: 1.1, MMAON: 20 } });
  });

  it('does not override an existing MMAON rate', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ base: 'USD', rates: { EUR: 1.1, MMAON: 5 } }),
      }),
    );
    const { getExchangeRates } = await import('./utils');
    const rates = await getExchangeRates();
    expect(rates.rates.MMAON).toBe(5);
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    const { getExchangeRates } = await import('./utils');
    await expect(getExchangeRates()).rejects.toThrow(
      /Could not fetch exchange rates/,
    );
  });

  it('throws when the response is missing base/rates', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    const { getExchangeRates } = await import('./utils');
    await expect(getExchangeRates()).rejects.toThrow(/Invalid rates format/);
  });
});

describe('getBudgetRecommendationsData', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetches and returns budget recommendations data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            USD: {
              budget: { default: 500, max: 1000 },
              hourly: { default: 60, max: 100 },
            },
          }),
      }),
    );
    const { getBudgetRecommendationsData } = await import('./utils');
    const data = await getBudgetRecommendationsData();
    expect(data.USD).toEqual({
      budget: { default: 500, max: 1000 },
      hourly: { default: 60, max: 100 },
    });
  });

  it('throws when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const { getBudgetRecommendationsData } = await import('./utils');
    await expect(getBudgetRecommendationsData()).rejects.toThrow(
      'Failed to fetch budget recommendations data.',
    );
  });
});

describe('getConnectWalletBudgetInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('uses budget recommendations data when available for the wallet asset code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('budget-suggestions')) {
          return {
            ok: true,
            json: async () => ({
              USD: {
                budget: { default: 5, max: 10 },
                hourly: { default: 0.36, max: 0.6 },
              },
            }),
          };
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
    const { getConnectWalletBudgetInfo } = await import('./utils');
    const result = await getConnectWalletBudgetInfo(makeWallet());
    expect(result).toEqual({
      defaultBudget: 5,
      defaultRateOfPay: '36',
      maxRateOfPay: '60',
    });
  });

  it('falls back to exchange-rate conversion when no recommendation exists for the asset code', async () => {
    const eurWallet = makeWallet({ assetCode: 'EUR' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('budget-suggestions')) {
          return { ok: true, json: async () => ({}) };
        }
        return {
          ok: true,
          json: async () => ({ base: 'USD', rates: { EUR: 1.1 } }),
        };
      }),
    );
    const { getConnectWalletBudgetInfo } = await import('./utils');
    const result = await getConnectWalletBudgetInfo(eurWallet);
    expect(result).toEqual({
      defaultBudget: 4.55,
      defaultRateOfPay: '55',
      maxRateOfPay: '91',
    });
  });

  it('falls back to identity-rate defaults when both budget recommendations and exchange rates fail to fetch', async () => {
    const eurWallet = makeWallet({ assetCode: 'EUR' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const { getConnectWalletBudgetInfo } = await import('./utils');
    const result = await getConnectWalletBudgetInfo(eurWallet);
    expect(result).toEqual({
      defaultBudget: 5,
      defaultRateOfPay: '60',
      maxRateOfPay: '100',
    });
  });
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

function makeBrowser() {
  const windows = {
    getLastFocused: vi
      .fn<MockedAsync<Browser['windows']['getLastFocused']>>()
      .mockResolvedValue({ id: 1 }),
  };

  const runtime = {
    getURL: vi.fn<Browser['runtime']['getURL']>(
      (path) => `chrome-extension://ext-id/${path}`,
    ),
    onConnect: {
      addListener: vi.fn<Browser['runtime']['onConnect']['addListener']>(),
      removeListener:
        vi.fn<Browser['runtime']['onConnect']['removeListener']>(),
    },
  };

  const tabs = {
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
  };

  return { windows, tabs, runtime };
}

// the fake above only implements the slice of Browser each test needs
type FakeBrowser = ReturnType<typeof makeBrowser>;
const asBrowser = (browser: FakeBrowser) => browser as unknown as Browser;

describe('getCurrentActiveTab', () => {
  it('queries the active tab in the last-focused window', async () => {
    const browser = makeBrowser();
    browser.windows.getLastFocused.mockResolvedValue({ id: 42 });
    browser.tabs.query.mockResolvedValue([{ id: 7 }]);
    const tab = await getCurrentActiveTab(asBrowser(browser));
    expect(browser.tabs.query).toHaveBeenCalledWith({
      active: true,
      windowId: 42,
    });
    expect(tab).toEqual({ id: 7 });
  });

  it('queries without a windowId when the windows API is unavailable', async () => {
    const browser = makeBrowser();
    // @ts-expect-error simulating a platform without the windows API (Firefox Android)
    browser.windows = undefined;
    browser.tabs.query.mockResolvedValue([{ id: 3 }]);
    const tab = await getCurrentActiveTab(asBrowser(browser));
    expect(browser.tabs.query).toHaveBeenCalledWith({
      active: true,
      windowId: undefined,
    });
    expect(tab).toEqual({ id: 3 });
  });
});

describe('highlightTab', () => {
  it('highlights the tab at its current index/window', async () => {
    const browser = makeBrowser();
    browser.tabs.get.mockResolvedValue({ index: 2, windowId: 5 });
    await highlightTab(asBrowser(browser), 9);
    expect(browser.tabs.get).toHaveBeenCalledWith(9);
    expect(browser.tabs.highlight).toHaveBeenCalledWith({
      tabs: [2],
      windowId: 5,
    });
  });

  it('does nothing when the highlight API is unavailable', async () => {
    const browser = makeBrowser();
    // @ts-expect-error simulating a platform without tabs.highlight
    browser.tabs.highlight = undefined;
    await highlightTab(asBrowser(browser), 9);
    expect(browser.tabs.get).not.toHaveBeenCalled();
  });

  it('swallows a failure from tabs.highlight', async () => {
    const browser = makeBrowser();
    browser.tabs.get.mockResolvedValue({ index: 2, windowId: 5 });
    browser.tabs.highlight.mockRejectedValue(new Error('cannot highlight'));
    await expect(highlightTab(asBrowser(browser), 9)).resolves.toBeUndefined();
  });
});

describe('closeTabsByFilter', () => {
  it('removes tabs matching the filter', async () => {
    const browser = makeBrowser();
    browser.tabs.query.mockResolvedValue([
      { id: 1, url: 'https://a.com' },
      { id: 2, url: 'https://b.com' },
    ]);
    await closeTabsByFilter(
      asBrowser(browser),
      (tab) => tab.url === 'https://b.com',
    );
    expect(browser.tabs.remove).toHaveBeenCalledTimes(1);
    expect(browser.tabs.remove).toHaveBeenCalledWith(2);
  });

  it('removes nothing when no tab matches', async () => {
    const browser = makeBrowser();
    browser.tabs.query.mockResolvedValue([{ id: 1, url: 'https://a.com' }]);
    await closeTabsByFilter(asBrowser(browser), () => false);
    expect(browser.tabs.remove).not.toHaveBeenCalled();
  });
});

describe('createTab', () => {
  it('creates a tab and returns its id', async () => {
    const browser = makeBrowser();
    browser.tabs.create.mockResolvedValue({ id: 11 });
    const tabId = await createTab(asBrowser(browser), 'https://example.com');
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com',
    });
    expect(tabId).toBe(11);
  });
});

describe('createTabIfNotExists', () => {
  it('creates a new tab when no tabId is given', async () => {
    const browser = makeBrowser();
    browser.tabs.create.mockResolvedValue({ id: 21 });
    const tabId = await createTabIfNotExists(
      asBrowser(browser),
      'https://example.com',
    );
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com',
    });
    expect(tabId).toBe(21);
  });

  it('reuses and updates the tab when it still exists', async () => {
    const browser = makeBrowser();
    browser.tabs.get.mockResolvedValue({ id: 5 });
    const tabId = await createTabIfNotExists(
      asBrowser(browser),
      'https://example.com',
      5,
    );
    expect(browser.tabs.get).toHaveBeenCalledWith(5);
    expect(browser.tabs.update).toHaveBeenCalledWith(5, {
      url: 'https://example.com',
    });
    expect(browser.tabs.create).not.toHaveBeenCalled();
    expect(tabId).toBe(5);
  });

  it('falls back to creating a tab when the given tabId no longer exists', async () => {
    const browser = makeBrowser();
    browser.tabs.get.mockRejectedValue(new Error('No tab'));
    browser.tabs.create.mockResolvedValue({ id: 8 });
    const tabId = await createTabIfNotExists(
      asBrowser(browser),
      'https://example.com',
      999,
    );
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com',
    });
    expect(tabId).toBe(8);
  });

  it('reuses the existing tab without updating it when url is empty', async () => {
    const browser = makeBrowser();
    browser.tabs.get.mockResolvedValue({ id: 5 });
    const tabId = await createTabIfNotExists(asBrowser(browser), '', 5);
    expect(browser.tabs.get).toHaveBeenCalledWith(5);
    expect(browser.tabs.update).not.toHaveBeenCalled();
    expect(tabId).toBe(5);
  });
});

describe('openAppPage', () => {
  it('updates and highlights an existing app tab found by tabId', async () => {
    const browser = makeBrowser();
    browser.tabs.get.mockResolvedValue({ id: 3, index: 0, windowId: 1 });
    const result = await openAppPage(asBrowser(browser), '/connect', {
      tabId: 3,
    });
    expect(browser.tabs.update).toHaveBeenCalledWith(3, {
      url: 'chrome-extension://ext-id/pages/app/index.html#/connect',
    });
    expect(browser.tabs.highlight).toHaveBeenCalledWith({
      tabs: [0],
      windowId: 1,
    });
    expect(result).toEqual({ id: 3, index: 0, windowId: 1 });
  });

  it('finds an already-open app tab via tabs.query when no tabId matches', async () => {
    const browser = makeBrowser();
    const appTab = {
      id: 4,
      index: 1,
      windowId: 1,
      url: 'chrome-extension://ext-id/pages/app/index.html#/home',
    };
    browser.tabs.get
      // first call: openAppPage's own lookup by the given (stale) tabId
      .mockRejectedValueOnce(new Error('not found'))
      // second call: highlightTab looking up the found app tab
      .mockResolvedValueOnce({
        index: appTab.index,
        windowId: appTab.windowId,
      });
    browser.tabs.query.mockResolvedValue([appTab]);
    const result = await openAppPage(asBrowser(browser), '/connect', {
      tabId: 999,
    });
    expect(browser.tabs.update).toHaveBeenCalledWith(4, {
      url: 'chrome-extension://ext-id/pages/app/index.html#/connect',
    });
    expect(result).toEqual(appTab);
  });

  it('creates a new tab when no app tab is open', async () => {
    const browser = makeBrowser();
    browser.tabs.create.mockResolvedValue({ id: 9 });
    const result = await openAppPage(asBrowser(browser), '/connect');
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://ext-id/pages/app/index.html#/connect',
    });
    expect(result).toEqual({ id: 9 });
  });
});

describe('redirectToPostConnect', () => {
  it('opens the app at the post-connect route', async () => {
    const browser = makeBrowser();
    await redirectToPostConnect(asBrowser(browser), 5);
    expect(browser.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://ext-id/pages/app/index.html#/post-connect',
    });
  });
});

describe('onPopupOpen', () => {
  function makePort(name: string, error?: unknown) {
    return {
      name,
      error,
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
    };
  }

  function getRegisteredListener(browser: FakeBrowser) {
    return browser.runtime.onConnect.addListener.mock.calls[0][0];
  }

  it('invokes the callback when the popup connects', () => {
    const browser = makeBrowser();
    const callback = vi.fn().mockResolvedValue(undefined);
    onPopupOpen(asBrowser(browser), callback);

    const listener = getRegisteredListener(browser);
    listener(makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME) as never);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores a connection that errored', () => {
    const browser = makeBrowser();
    const callback = vi.fn();
    onPopupOpen(asBrowser(browser), callback);

    const listener = getRegisteredListener(browser);
    listener(
      makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME, new Error('boom')) as never,
    );

    expect(callback).not.toHaveBeenCalled();
  });

  it('ignores connections on other ports', () => {
    const browser = makeBrowser();
    const callback = vi.fn();
    onPopupOpen(asBrowser(browser), callback);

    const listener = getRegisteredListener(browser);
    listener(makePort('some-other-port') as never);

    expect(callback).not.toHaveBeenCalled();
  });

  it('registers a disconnect listener that runs the close callback and detaches itself', () => {
    const browser = makeBrowser();
    const callback = vi.fn().mockResolvedValue(undefined);
    const closeCallback = vi.fn().mockResolvedValue(undefined);
    onPopupOpen(asBrowser(browser), callback, closeCallback);

    const listener = getRegisteredListener(browser);
    const port = makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME);
    listener(port as never);

    expect(port.onDisconnect.addListener).toHaveBeenCalledTimes(1);
    const disconnectListener = port.onDisconnect.addListener.mock.calls[0][0];
    disconnectListener();

    expect(closeCallback).toHaveBeenCalledTimes(1);
    expect(port.onDisconnect.removeListener).toHaveBeenCalledWith(
      disconnectListener,
    );
  });

  it('the returned cleanup function removes the connect listener', () => {
    const browser = makeBrowser();
    const cleanup = onPopupOpen(asBrowser(browser), vi.fn());
    cleanup();
    expect(browser.runtime.onConnect.removeListener).toHaveBeenCalled();
  });

  it('the cleanup function also detaches an already-connected port', () => {
    const browser = makeBrowser();
    const callback = vi.fn().mockResolvedValue(undefined);
    const closeCallback = vi.fn().mockResolvedValue(undefined);
    const cleanup = onPopupOpen(asBrowser(browser), callback, closeCallback);

    const listener = getRegisteredListener(browser);
    const port = makePort(BACKGROUND_TO_POPUP_CONNECTION_NAME);
    listener(port as never);
    const disconnectListener = port.onDisconnect.addListener.mock.calls[0][0];

    cleanup();

    expect(port.onDisconnect.removeListener).toHaveBeenCalledWith(
      disconnectListener,
    );
    // the port disconnecting on its own never fired, so the close callback
    // (as opposed to the cleanup itself) should not have run
    expect(closeCallback).not.toHaveBeenCalled();
  });
});

describe('getTabId', () => {
  it('returns the sender tab id', () => {
    const sender = { tab: { id: 42 } } as Runtime.MessageSender;
    expect(getTabId(sender)).toBe(42);
  });

  it('throws when the sender has no tab', () => {
    const sender = {} as Runtime.MessageSender;
    expect(() => getTabId(sender)).toThrow(/sender\.tab/);
  });

  it('throws when the tab has no id', () => {
    const sender = { tab: {} } as Runtime.MessageSender;
    expect(() => getTabId(sender)).toThrow(/tab\.id/);
  });
});

describe('getTab', () => {
  it('returns the sender tab', () => {
    const tab = { id: 42, url: 'https://example.com' };
    const sender = { tab } as Runtime.MessageSender;
    expect(getTab(sender)).toEqual(tab);
  });

  it('throws when the sender has no tab', () => {
    const sender = {} as Runtime.MessageSender;
    expect(() => getTab(sender)).toThrow(/sender\.tab/);
  });
});

describe('getSender', () => {
  it('extracts tabId, frameId and url from the message sender', () => {
    const sender = {
      tab: { id: 42 },
      frameId: 0,
      url: 'https://example.com',
    } as Runtime.MessageSender;
    expect(getSender(sender)).toEqual({
      tabId: 42,
      frameId: 0,
      url: 'https://example.com',
    });
  });

  it('throws when frameId is missing', () => {
    const sender = { tab: { id: 42 } } as Runtime.MessageSender;
    expect(() => getSender(sender)).toThrow(/frameId/);
  });
});
