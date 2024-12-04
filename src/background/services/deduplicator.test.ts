import { Deduplicator } from './deduplicator';
import { Logger } from '@/shared/logger';

describe('Deduplicator', () => {
  const deduplicatorService: Deduplicator = new Deduplicator({
    logger: {
      debug: jest.fn(),
    } as unknown as Logger,
  });
  let returnValueFn1: {
    access_token: { value: string; type: string };
  };
  let returnValueFn2: {
    access_token: { value: string; type: string };
  };

  beforeAll(async (): Promise<void> => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.runAllTimers();
    returnValueFn1 = {
      access_token: {
        value: 'value',
        type: 'incoming-payment',
      },
    };
    returnValueFn2 = {
      access_token: {
        value: 'value',
        type: 'incoming-payment',
      },
    };
  });

  // utility function to create async functions for testing
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
    const fn = jest.fn(
      async (..._args: unknown[]) =>
        // returns an anonymous function, which is created using the new Promise constructor.
        // it needs a `name` property, to have a key for deduplication service
        new Promise((resolve, reject) => {
          try {
            if (shouldReject) {
              reject(new Error('Test error'));
            }
            setTimeout(() => {
              resolve(returnValue);
            }, timeout);
          } catch (e) {
            reject(e);
          }
        }),
    );
    Object.defineProperty(fn, 'name', { value: mockFnName });

    return fn;
  };

  describe('Basic Deduplication', () => {
    it('should call the original function only once for multiple simultaneous calls', async () => {
      const returnValue = {
        access_token: { value: 'value', access: { type: 'incoming-payment' } },
      };
      const fn = createAsyncFn({ returnValue });
      const dedupedFn = deduplicatorService.dedupe(fn);
      const resultPromises = [dedupedFn(), dedupedFn(), dedupedFn()];
      jest.runAllTimers();

      const results = await Promise.all(resultPromises);
      expect(results[0]).toBe(returnValue);
      expect(results[1]).toBe(returnValue);
      expect(results[2]).toBe(returnValue);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should support different function signatures', async () => {
      const fn1 = createAsyncFn({
        returnValue: returnValueFn1,
        timeout: 100,
        mockFnName: 'fn1',
      });
      const fn2 = createAsyncFn({
        returnValue: returnValueFn2,
        timeout: 400,
        mockFnName: 'fn2',
      });
      const dedupedFn1 = deduplicatorService.dedupe(fn1);
      const dedupedFn2 = deduplicatorService.dedupe(fn2);
      const resultPromises = [dedupedFn1('arg1'), dedupedFn2('arg2')];

      jest.runAllTimers();

      const [result1, result2] = await Promise.all(resultPromises);

      expect(result1).toBe(returnValueFn1);
      expect(result2).toBe(returnValueFn2);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should cache and reuse pending function calls for same fn names, but different args', async () => {
      const fn1 = createAsyncFn({ returnValue: returnValueFn1, timeout: 100 });
      const fn2 = createAsyncFn({ returnValue: returnValueFn2, timeout: 400 });

      const dedupedFn1 = deduplicatorService.dedupe(fn1);
      const dedupedFn2 = deduplicatorService.dedupe(fn2);

      // create same signature functions, but with different arguments and cacheFnArgs false by default
      const result1 = dedupedFn1(1, { object: { key: 'arg1' } });
      // at this point, result1 promise is still pending,
      // cache will return and reuse the same pending promise to result2
      const result2 = dedupedFn2({ object: { key: 'arg2' } }, 2);
      const result3 = dedupedFn2({ object: { key: 'arg3' } }, 3);
      jest.runAllTimers();

      await expect(result1).resolves.toBe(returnValueFn1);
      await expect(result2).resolves.toBe(returnValueFn1);
      await expect(result3).resolves.toBe(returnValueFn1);
      expect(fn1).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Arguments Configuration', () => {
    it('should differentiate same fn calls with different arguments when cacheFnArgs is true', async () => {
      const returnValue = {
        access_token: { value: 'value', access: { type: 'outgoing-incoming' } },
      };
      const fn = createAsyncFn({ returnValue });
      const dedupedFn = deduplicatorService.dedupe(fn, {
        cacheFnArgs: true,
      });

      const dedupedFnArg1 = {
        array: [1, 2, 3],
        obj: { key: 'arg1' },
      };
      dedupedFn(dedupedFnArg1);
      const dedupedFnArg2 = ['arg2'];
      dedupedFn(dedupedFnArg2);
      jest.runAllTimers();

      expect(fn).toHaveBeenCalledWith(dedupedFnArg1);
      expect(fn).toHaveBeenCalledWith(dedupedFnArg2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should cache same fn calls with the same arguments when cacheFnArgs is true', async () => {
      const returnValue = {
        access_token: { value: 'value', access: { type: 'quote' } },
      };
      const fn = createAsyncFn({ returnValue });
      const dedupedFn = deduplicatorService.dedupe(fn, {
        cacheFnArgs: true,
      });

      const resultPromises = [
        dedupedFn(1, { object: { key: 'arg' } }),
        dedupedFn(1, { object: { key: 'arg' } }),
        dedupedFn(1, { object: { key: 'arg' } }),
      ];
      jest.runAllTimers();
      const [result1, result2, result3] = await Promise.all(resultPromises);

      expect(result1).toBe(returnValue);
      expect(result2).toBe(returnValue);
      expect(result3).toBe(returnValue);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should support different fn signatures when cacheFnArgs is true with different args', async () => {
      const fn1 = createAsyncFn({ returnValue: returnValueFn1, timeout: 100 });
      const fn2 = createAsyncFn({ returnValue: returnValueFn2, timeout: 400 });
      const dedupedFn1 = deduplicatorService.dedupe(fn1, {
        cacheFnArgs: true,
      });
      const dedupedFn2 = deduplicatorService.dedupe(fn2, {
        cacheFnArgs: true,
      });
      // create same signature functions, but with different arguments
      const resultPromises = [
        dedupedFn1(1, {
          nested: {
            array: [1, 2, 3],
            obj: { key: 'arg1' },
          },
        }),
        dedupedFn2(2, {
          nested: {
            array: [4, 5, 6],
            obj: { key: 'arg2' },
          },
        }),
      ];

      jest.runAllTimers();

      const [result1, result2] = await Promise.all(resultPromises);

      expect(result1).toBe(returnValueFn1);
      expect(result2).toBe(returnValueFn2);
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling, cacheRejections', () => {
    it('should not cache rejections by default', async () => {
      const fn = createAsyncFn({
        returnValue: { value: 'value', access: { type: 'incoming-payment' } },
        shouldReject: true,
        timeout: 500,
      });
      const dedupedFn = deduplicatorService.dedupe(fn);

      // fn will reject immediately with error
      const result1 = dedupedFn(1, { key: 'value' });
      // wait for result1 to finish execution and reject
      await expect(result1).rejects.toThrow('Test error');
      // deduplicator cache is updated with the rejected result from the first call,
      // call will not use the cache and will execute the original function fn(1, 2) again
      const result2 = dedupedFn(1, { key: 'value' });
      await expect(result2).rejects.toThrow('Test error');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should cache and reuse pending promises when cacheRejections is false by default', async () => {
      const fn = createAsyncFn({
        returnValue: { value: 'value', access: { type: 'outgoing-payment' } },
        shouldReject: true,
        timeout: 500,
      });
      const dedupedFn = deduplicatorService.dedupe(fn);
      const result1 = dedupedFn(1, 2);
      // at this point, result1 promise is still pending,
      // cache will return and reuse the same pending promise to result2
      const result2 = dedupedFn(1, 2);
      jest.runAllTimers();

      await expect(result1).rejects.toThrow('Test error');
      await expect(result2).rejects.toThrow('Test error');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cache and reuse rejected promises when cacheRejections is true', async () => {
      const fn = createAsyncFn({
        returnValue: { value: 'value', access: { type: 'incoming-payment' } },
        shouldReject: true,
        timeout: 500,
      });
      const dedupedFn = deduplicatorService.dedupe(fn, {
        cacheRejections: true,
      });

      const result1 = dedupedFn();
      await expect(result1).rejects.toThrow('Test error');
      const result2 = dedupedFn();
      await expect(result2).rejects.toThrow('Test error');
      await expect(result1).rejects.toBe(await result2.catch((e) => e));
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Expiration', () => {
    it('should clear cache after specified wait time', async () => {
      const timeout = 2000;
      const returnValue = {
        access_token: { value: 'value', access: { type: 'incoming-payment' } },
      };
      const fn = createAsyncFn({ returnValue, timeout });
      const dedupedFn = deduplicatorService.dedupe(fn);

      const promise1 = dedupedFn();
      jest.runAllTimers();
      const results = await promise1;
      expect(results).toBe(returnValue);

      jest.advanceTimersByTime(timeout);
      jest.runAllTimers();

      const promise2 = dedupedFn();
      jest.runAllTimers();
      const results2 = await promise2;
      expect(results2).toBe(returnValue);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
