import type { Cradle } from '../container';

type AsyncFn<T> = (...args: unknown[]) => Promise<T>;

interface CacheEntry<T> {
  promise: Promise<T>;
}

interface DedupeOptions {
  cacheFnArgs: boolean;
  cacheRejections: boolean;
  wait: number;
}

export class Deduplicator {
  private logger: Cradle['logger'];

  private cache: Map<string, CacheEntry<unknown>> = new Map();

  constructor({ logger }: Pick<Cradle, 'logger'>) {
    Object.assign(this, { logger });
  }

  dedupe<T>(
    fn: AsyncFn<T>,
    {
      cacheFnArgs = false,
      cacheRejections = false,
      wait = 5000,
    }: Partial<DedupeOptions> = {},
  ): AsyncFn<T> {
    return async (...args: Parameters<typeof fn>): Promise<T> => {
      const key = this.generateCacheKey(fn, args, cacheFnArgs);
      const entry = this.cache.get(key);

      if (entry) {
        this.logger.debug(
          `Deduplicating function=${fn.name}, ${cacheFnArgs ? `args=${JSON.stringify(args)}` : 'without args'}`,
        );
        return entry.promise as Promise<T>;
      }

      const promise = fn(...args);
      this.cache.set(key, { promise });

      try {
        const res = await promise;
        this.cache.set(key, { promise: Promise.resolve(res) });
        return res;
      } catch (err) {
        if (cacheRejections) {
          this.cache.set(key, { promise: Promise.reject(err) });
        } else {
          this.cache.delete(key);
        }
        return Promise.reject(err);
      } finally {
        this.scheduleCacheClear(key, wait);
      }
    };
  }

  private generateCacheKey<T>(
    fn: AsyncFn<T>,
    args: unknown[],
    cacheFnArgs: boolean,
  ): string {
    if (!fn.name) {
      throw new Error('Function name is required for caching');
    }
    let key = fn.name;
    if (cacheFnArgs) {
      key += `_${JSON.stringify(args)}`;
    }
    return key;
  }

  private scheduleCacheClear(key: string, wait: number): void {
    setTimeout(() => {
      this.logger.debug(`Attempting to remove key=${key} from cache.`);
      const entry = this.cache.get(key);
      if (entry) {
        this.logger.debug(`Removing key=${key} from cache.`);
        this.cache.delete(key);
      }
    }, wait);
  }
}
