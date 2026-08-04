// cSpell:ignore wwwexample
import { addDays } from 'date-fns/addDays';
import { addMonths } from 'date-fns/addMonths';
import { addSeconds } from 'date-fns/addSeconds';
import {
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
  type MockedFunction,
} from 'vitest';
import {
  objectEquals,
  normalizeHostname,
  withResolvers,
  getNextOccurrence,
  toWalletAddressUrl,
  setDifference,
  memoize,
  moveToFront,
} from '../helpers';

describe('objectEquals', () => {
  it('should return true if objects are equal', () => {
    expect(objectEquals({}, {})).toBe(true);
    expect(objectEquals({ a: 1 }, { a: 1 })).toBe(true);
    expect(objectEquals({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(objectEquals({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });

  it('should return false if objects are not equal', () => {
    expect(objectEquals({ a: 1 }, { a: 2 })).toBe(false);
    expect(objectEquals({ a: 1 }, { b: 1 })).toBe(false);
  });
});

describe('moveToFront', () => {
  it('should move an existing item to the front of the array', () => {
    const array = [1, 2, 3, 4];
    moveToFront(array, 3);
    expect(array).toEqual([3, 1, 2, 4]);
  });

  it('should not modify the array if the item is already at the front', () => {
    const array = [1, 2, 3, 4];
    moveToFront(array, 1);
    expect(array).toEqual([1, 2, 3, 4]);
  });

  it('should not modify the array if the item does not exist', () => {
    const array = [1, 2, 3, 4];
    moveToFront(array, 5);
    expect(array).toEqual([1, 2, 3, 4]);
  });

  it('should handle an empty array without errors', () => {
    const array: number[] = [];
    moveToFront(array, 1);
    expect(array).toEqual([]);
  });

  it('should work with strings', () => {
    const array = ['a', 'b', 'c', 'd'];
    moveToFront(array, 'c');
    expect(array).toEqual(['c', 'a', 'b', 'd']);
  });

  it('should work with objects using reference equality', () => {
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const obj3 = { id: 3 };
    const array = [obj1, obj2, obj3];
    moveToFront(array, obj3);
    expect(array).toEqual([obj3, obj1, obj2]);
  });
});

describe('normalizeHostname', () => {
  it('strips www. prefix', () => {
    expect(normalizeHostname('www.example.com')).toBe('example.com');
    expect(normalizeHostname('www.example.co.uk')).toBe('example.co.uk');
  });

  it('leaves non-www hostnames unchanged', () => {
    expect(normalizeHostname('example.com')).toBe('example.com');
    expect(normalizeHostname('sub.example.com')).toBe('sub.example.com');
    expect(normalizeHostname('wwwexample.com')).toBe('wwwexample.com');
  });
});

test('setDifference', () => {
  const set = <T>(...items: T[]) => new Set(items);
  expect(setDifference(set(1, 2, 3), set(2, 3, 4))).toEqual(set(1));
  expect(setDifference(set(1, 2, 3), set(1, 2))).toEqual(set(3));
  expect(setDifference(set(3), set(1, 2))).toEqual(set(3));
  expect(setDifference(set(1, 2, 3), set(1, 2, 3))).toEqual(set());
  expect(setDifference(set('a', 'b', 'c'), set('b', 'c'))).toEqual(set('a'));

  const a = { foo: 1 };
  const b = { foo: 2 };
  const c = { foo: 3 };
  const diff = setDifference(set(a, b, c), set(b, c));
  expect(diff).toEqual(set(a));
  expect(diff).toContain(a);
});

describe('withResolvers', () => {
  it('resolves', async () => {
    const r = withResolvers<boolean>();
    r.resolve(true);
    r.reject(false);
    await expect(r.promise).resolves.toBe(true);
  });

  it('rejects', async () => {
    const r = withResolvers<boolean>();
    r.reject(false);
    r.resolve(true);
    await expect(r.promise).rejects.toBe(false);
  });
});

describe('getNextOccurrence', () => {
  const now = new Date();
  const nowISO = now.toISOString();
  const dateJan = new Date('2024-01-03T00:00:00.000Z');
  const dateJanEnd = new Date('2024-01-30T00:00:00.000Z');
  const dateFeb = new Date('2023-02-03T00:00:00.000Z');
  const dateFebLeap = new Date('2024-02-29T00:00:00.000Z');
  const dateApr = new Date('2024-04-03T00:00:00.000Z');

  it('should return the next occurrence with /P1M', () => {
    expect(
      getNextOccurrence(`R/${dateJan.toISOString()}/P1M`, dateJan),
    ).toEqual(addMonths(dateJan, 1));
    expect(
      getNextOccurrence(`R/${dateJan.toISOString()}/P1M`, addDays(dateJan, 2)),
    ).toEqual(addMonths(dateJan, 1));
    expect(
      getNextOccurrence(`R/${dateJanEnd.toISOString()}/P1M`, dateJanEnd),
    ).toEqual(new Date('2024-03-01T00:00:00.000Z'));
    expect(
      getNextOccurrence(`R/${dateFeb.toISOString()}/P1M`, dateFeb),
    ).toEqual(addMonths(dateFeb, 1));
    expect(
      getNextOccurrence(`R/${dateFebLeap.toISOString()}/P1M`, dateFebLeap),
    ).toEqual(addMonths(dateFebLeap, 1));
    expect(
      getNextOccurrence(`R/${dateApr.toISOString()}/P1M`, dateApr),
    ).toEqual(addMonths(dateApr, 1));
  });

  it('should return next occurrence with /P1W', () => {
    expect(
      getNextOccurrence(`R/${dateJan.toISOString()}/P1W`, dateJan),
    ).toEqual(addDays(dateJan, 7));
    expect(
      getNextOccurrence(`R/${dateFeb.toISOString()}/P1W`, dateFeb),
    ).toEqual(addDays(dateFeb, 7));
    expect(
      getNextOccurrence(`R/${dateFebLeap.toISOString()}/P1W`, dateFebLeap),
    ).toEqual(addDays(dateFebLeap, 7));
    expect(
      getNextOccurrence(`R/${dateApr.toISOString()}/P1W`, dateApr),
    ).toEqual(addDays(dateApr, 7));
  });

  it('should throw if no more occurrences are possible', () => {
    const interval = `R1/${dateJan.toISOString()}/P1M`;
    const errorMsg = /No next occurrence is possible/;

    expect(() =>
      getNextOccurrence(interval, addMonths(dateJan, 0)),
    ).not.toThrow(errorMsg);
    expect(() => getNextOccurrence(interval, addDays(dateJan, 10))).not.toThrow(
      errorMsg,
    );

    expect(() => getNextOccurrence(interval, addMonths(dateJan, 1))).toThrow(
      errorMsg,
    );
    expect(() => getNextOccurrence(interval, addMonths(dateJan, 2))).toThrow(
      errorMsg,
    );
  });

  it('should return the next occurrence with /PT', () => {
    expect(getNextOccurrence(`R/${nowISO}/PT30S`, now)).toEqual(
      addSeconds(now, 30),
    );
  });

  it('should throw for a malformed interval', () => {
    expect(() => getNextOccurrence('not-an-interval')).toThrow(
      'Invalid interval: not-an-interval',
    );
  });
});

describe('toWalletAddressUrl', () => {
  it('converts from short form to long form', () => {
    expect(toWalletAddressUrl('$wallet.com/bob')).toBe(
      'https://wallet.com/bob',
    );
    expect(toWalletAddressUrl('$wallet.com/bob/')).toBe(
      'https://wallet.com/bob',
    );
    expect(toWalletAddressUrl('$sub.wallet.com/bob/')).toBe(
      'https://sub.wallet.com/bob',
    );
    expect(toWalletAddressUrl('$wallet.com')).toBe(
      'https://wallet.com/.well-known/pay',
    );
    expect(toWalletAddressUrl('$sub.wallet.com')).toBe(
      'https://sub.wallet.com/.well-known/pay',
    );
    expect(toWalletAddressUrl('$wallet.com/')).toBe(
      'https://wallet.com/.well-known/pay',
    );
  });

  it('preserves https:// form as is', () => {
    expect(toWalletAddressUrl('https://wallet.com/bob')).toBe(
      'https://wallet.com/bob',
    );
    expect(toWalletAddressUrl('https://wallet.com')).toBe('https://wallet.com');
  });
});

describe('memoize', () => {
  vi.useFakeTimers();

  type SuccessResponse = { data: string };
  type MockFunction = () => Promise<SuccessResponse>;

  const successResponse1: SuccessResponse = { data: 'success1' };
  const successResponse2: SuccessResponse = { data: 'success2' };
  const errorResponse = new Error('failure');

  let mockFn: MockedFunction<MockFunction>;
  beforeEach(() => {
    mockFn = vi.fn();
  });

  it('should cache the result of a successful promise with max-age mechanism', async () => {
    mockFn.mockResolvedValueOnce(successResponse1);
    mockFn.mockResolvedValueOnce(successResponse2);
    const memoizedFn = memoize(mockFn, { maxAge: 1000, mechanism: 'max-age' });

    const result1 = await memoizedFn();
    const result2 = await memoizedFn();

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result1).toBe(successResponse1);
    expect(result2).toBe(successResponse1);

    vi.advanceTimersByTime(1001);
    const result3 = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result3).toBe(successResponse2);
  });

  it('should cache the result of a successful promise with stale-while-revalidate mechanism', async () => {
    mockFn.mockResolvedValueOnce(successResponse1);
    mockFn.mockResolvedValueOnce(successResponse2);
    const memoizedFn = memoize(mockFn, {
      maxAge: 1000,
      mechanism: 'stale-while-revalidate',
    });

    const result1 = await memoizedFn();
    const result2 = await memoizedFn();

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(result1).toBe(successResponse1);
    expect(result2).toBe(successResponse1);

    vi.advanceTimersByTime(1001);
    const result3 = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result3).toBe(successResponse1);

    vi.advanceTimersByTime(50);
    const result4 = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result4).toBe(successResponse2);
  });

  it('should reject if there is an error in first call with max-age mechanism', async () => {
    mockFn.mockRejectedValueOnce(errorResponse);
    mockFn.mockResolvedValueOnce(successResponse1);

    const memoizedFn = memoize(mockFn, { maxAge: 1000, mechanism: 'max-age' });

    await expect(memoizedFn).rejects.toBe(errorResponse);
    expect(mockFn).toHaveBeenCalledTimes(1);

    const result = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result).toBe(successResponse1);
  });

  it('should not return error response from previous call when using state-while-revalidate mechanism', async () => {
    mockFn.mockRejectedValueOnce(errorResponse);
    mockFn.mockResolvedValueOnce(successResponse1);
    mockFn.mockRejectedValueOnce(errorResponse);
    mockFn.mockResolvedValueOnce(successResponse2);

    const memoizedFn = memoize(mockFn, {
      maxAge: 1000,
      mechanism: 'stale-while-revalidate',
    });

    await expect(memoizedFn).rejects.toBe(errorResponse);
    expect(mockFn).toHaveBeenCalledTimes(1);

    const result1 = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result1).toBe(successResponse1);

    vi.advanceTimersByTime(1001);

    // even though 3rd call results in an error, reuse successful response from
    // a previous call
    const result2 = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockFn.mock.results.at(-1)).toEqual(
      expect.objectContaining(errorResponse),
    );
    expect(result2).toBe(successResponse1);

    const result3 = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(4);
    expect(result3).toBe(successResponse2);
  });
});
