import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  convertWithExchangeRate,
  dedupe,
  getNextSendableAmount,
  isSecureContext,
} from './utils';

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
