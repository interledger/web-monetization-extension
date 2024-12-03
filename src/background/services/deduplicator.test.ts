import { Deduplicator } from './deduplicator';
import { Logger } from '@/shared/logger';

describe('Deduplicator', () => {
  const deduplicatorService: Deduplicator = new Deduplicator({
    logger: {
      debug: jest.fn(),
    } as unknown as Logger,
  });

  beforeAll(async (): Promise<void> => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.runAllTimers();
  });

  // utility function to create async functions for testing
  const createAsyncFn = <T>({
    returnValue,
    timeout = 0,
    shouldReject = false,
  }: {
    returnValue: T;
    timeout?: number;
    shouldReject?: boolean;
  }) =>
    jest.fn(
      async (..._args: unknown[]) =>
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

  describe('Basic Deduplication', () => {
    it('should call the original function only once for multiple simultaneous calls', async () => {
      const returnValue = {
        access_token: { value: 'value', access: { type: 'incoming' } },
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
        returnValue: 'hello',
        timeout: 100,
      });
      Object.defineProperty(fn1, 'name', { value: 'fn1' });
      // createAsyncFn function returns an anonymous function, which is created using the new Promise constructor.
      // it does not have a `name` property, so it does NOT have a key for deduplication service
      const fn2 = createAsyncFn({
        returnValue: 'world',
        timeout: 400,
      });
      Object.defineProperty(fn2, 'name', { value: 'fn2' });
      const dedupedFn1 = deduplicatorService.dedupe(fn1);
      const dedupedFn2 = deduplicatorService.dedupe(fn2);
      const resultPromises = [dedupedFn1('arg1'), dedupedFn2('arg2')];

      jest.runAllTimers();

      const [result1, result2] = await Promise.all(resultPromises);

      expect(result1).toBe('hello');
      expect(result2).toBe('world');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Arguments Configuration', () => {
    it('should differentiate calls with different arguments when cacheFnArgs is true', async () => {
      const returnValue = 2n;
      const fn = createAsyncFn({ returnValue });
      const dedupedFn = deduplicatorService.dedupe(fn, {
        cacheFnArgs: true,
      });

      dedupedFn('arg1');
      dedupedFn('arg2');
      jest.runAllTimers();

      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('arg1');
      expect(fn).toHaveBeenCalledWith('arg2');
    });

    it('should cache calls with the same arguments when cacheFnArgs is true', async () => {
      const returnValue = 2n;
      const fn = createAsyncFn({ returnValue });
      const dedupedFn = deduplicatorService.dedupe(fn, {
        cacheFnArgs: true,
      });

      const resultPromises = [dedupedFn(1, 2), dedupedFn(1, 2)];
      jest.runAllTimers();
      const [result1, result2] = await Promise.all(resultPromises);

      expect(result1).toBe(returnValue);
      expect(result2).toBe(returnValue);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should support different function signatures', async () => {
      const fn1 = createAsyncFn({ returnValue: 'hello', timeout: 100 });
      const fn2 = createAsyncFn({ returnValue: 'world', timeout: 400 });
      const dedupedFn1 = deduplicatorService.dedupe(fn1, {
        cacheFnArgs: true,
      });
      const dedupedFn2 = deduplicatorService.dedupe(fn2, {
        cacheFnArgs: true,
      });
      const resultPromises = [dedupedFn1('arg1'), dedupedFn2('arg2')];

      jest.runAllTimers();

      const [result1, result2] = await Promise.all(resultPromises);

      expect(result1).toBe('hello');
      expect(result2).toBe('world');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling, cacheRejections', () => {
    it('should not cache rejections by default', async () => {
      const fn = createAsyncFn({
        returnValue: 2n,
        shouldReject: true,
        timeout: 500,
      });
      const dedupedFn = deduplicatorService.dedupe(fn);

      // fn will reject immediately with error
      const result1 = dedupedFn(1, 2);
      // wait for result1 to finish execution and reject
      await expect(result1).rejects.toThrow('Test error');
      // deduplicator cache is updated with the rejected result from the first call,
      // call will not use the cache and will execute the original function fn(1, 2) again
      const result2 = dedupedFn(1, 2);
      await expect(result2).rejects.toThrow('Test error');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should cache and reuse pending promises when cacheRejections is false', async () => {
      const fn = createAsyncFn({
        returnValue: 2n,
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

    it('should cache rejections when cacheRejections is true', async () => {
      const fn = createAsyncFn({
        returnValue: 2n,
        shouldReject: true,
        timeout: 500,
      });
      const dedupedFn = deduplicatorService.dedupe(fn, {
        cacheRejections: true,
      });

      await expect(dedupedFn()).rejects.toThrow('Test error');
      await expect(dedupedFn()).rejects.toThrow('Test error');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cache and reuse rejected promises when cacheRejections is true', async () => {
      const fn = createAsyncFn({
        returnValue: 2n,
        shouldReject: true,
        timeout: 500,
      });
      const dedupedFn = deduplicatorService.dedupe(fn, {
        cacheRejections: true,
      });

      const result1 = dedupedFn(1, 2);
      await expect(result1).rejects.toThrow('Test error');
      const result2 = dedupedFn(1, 2);
      await expect(result2).rejects.toThrow('Test error');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Expiration', () => {
    jest.useFakeTimers();

    it('should clear cache after specified wait time', async () => {
      const timeout = 2000;
      const fn = createAsyncFn({ returnValue: 2n, timeout });
      const dedupedFn = deduplicatorService.dedupe(fn);

      const promise1 = dedupedFn();
      jest.runAllTimers();
      const results = await promise1;
      expect(results).toBe(2n);

      jest.advanceTimersByTime(timeout);
      jest.runAllTimers();

      const promise2 = dedupedFn();
      jest.runAllTimers();
      const results2 = await promise2;
      expect(results2).toBe(2n);

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
