import { AwilixContainer } from 'awilix';
import { Deduplicator } from './deduplicator';
import { configureContainer, Cradle } from '@/background/container';

describe('Deduplicator', () => {
  let bindings: AwilixContainer<Cradle>;
  let deduplicatorService: Deduplicator;

  beforeAll(async (): Promise<void> => {
    jest.useFakeTimers();
    bindings = await configureContainer();
    deduplicatorService = bindings.resolve('deduplicator');
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
          } catch (err) {
            // eslint-disable-next-line no-console
            console.log(err);
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

      // advance timers to trigger the async function
      jest.runAllTimers();

      const results = await Promise.all(resultPromises);

      expect(results[0]).toBe(returnValue);
      expect(results[1]).toBe(returnValue);
      expect(results[2]).toBe(returnValue);
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
      // createAsyncFn function returns an anonymous function, which is created using the new Promise constructor.
      // it does not have a name property, so it does NOT have a key for dedup
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
  });

  describe('Error Handling, cacheRejections', () => {
    it('should not cache rejections by default', async () => {
      const fn = createAsyncFn({
        returnValue: 2n,
        shouldReject: true,
        timeout: 500,
      });
      const dedupedFn = deduplicatorService.dedupe(fn);

      const resultPromises = [dedupedFn(1, 2), dedupedFn(1, 2)];
      jest.runAllTimers();
      const [result1, result2] = await Promise.all(resultPromises);
      await expect(result1).rejects.toThrow('Test error');
      await expect(result2).rejects.toThrow('Test error');

      expect(fn).toHaveBeenCalledTimes(2);
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
  });

  // describe('Cache Expiration', () => {
  //   jest.useFakeTimers();

  //   it('should clear cache after specified wait time', async () => {
  //     const timeout = 1000;
  //     const fn = createAsyncFn({ returnValue: 2n, timeout });
  //     const dedupedFn = deduplicatorService.dedupe(fn);

  //     await dedupedFn();
  //     expect(fn).toHaveBeenCalledTimes(1);

  //     jest.advanceTimersByTime(timeout);

  //     await dedupedFn();
  //     expect(fn).toHaveBeenCalledTimes(2);
  //   });
  // });

  // describe('Default Configurations', () => {
  //   it('should use default cache promises time of 5000ms', async () => {
  //     const asyncFn = createAsyncFn({ returnValue: 2n });
  //     const dedupedFn = deduplicatorService.dedupe(asyncFn);

  //     await dedupedFn();

  //     // verify default configuration
  //     jest.advanceTimersByTime(5000);

  //     expect(mockLogger.debug).toHaveBeenCalledWith(
  //       expect.stringContaining('Attempting to remove key'),
  //     );
  //   });
  // });
});
