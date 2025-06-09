import { addDays, addMonths, addSeconds } from 'date-fns';
import {
  isOkState,
  objectEquals,
  removeQueryParams,
  withResolvers,
  getNextOccurrence,
  toWalletAddressUrl,
  setDifference,
  Timeout,
  memoize,
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
});

describe('toWalletAddressUrl', () => {
  it('converts from short form to long form', () => {
    expect(toWalletAddressUrl('$wallet.com/bob')).toEqual(
      'https://wallet.com/bob',
    );
  });
});

describe('Timeout', () => {
  jest.useFakeTimers();

  let callback: jest.Mock;
  let timeout: Timeout;
  beforeEach(() => {
    callback = jest.fn();
    timeout = new Timeout(1000, callback);
  });

  afterEach(() => {
    jest.clearAllTimers();
    test;
  });

  it('should call the callback after the specified time', () => {
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reset the timeout', () => {
    timeout.reset(2000);
    // @ts-expect-error for testing it's ok to access private properties
    expect(timeout.ms).toBe(2000);
    jest.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pause the timeout', () => {
    timeout.pause();
    jest.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should resume the timeout', () => {
    timeout.pause();
    jest.advanceTimersByTime(500);
    timeout.resume();
    jest.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should clear the timeout', () => {
    timeout.clear();
    jest.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('memoize', () => {
  jest.useFakeTimers();

  type SuccessResponse = { data: string };
  type MockFunction = () => Promise<SuccessResponse>;

  const successResponse1: SuccessResponse = { data: 'success1' };
  const successResponse2: SuccessResponse = { data: 'success2' };
  const errorResponse = new Error('failure');

  let mockFn: jest.MockedFunction<MockFunction>;
  beforeEach(() => {
    mockFn = jest.fn();
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

    jest.advanceTimersByTime(1001);
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

    jest.advanceTimersByTime(1001);
    const result3 = await memoizedFn();
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(result3).toBe(successResponse1);

    jest.advanceTimersByTime(50);
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

    jest.advanceTimersByTime(1001);

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