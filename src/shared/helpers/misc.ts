import type { Browser } from 'webextension-polyfill';
import type { Storage } from '../types';

export const notNullOrUndef = <T>(
  t: T | null | undefined,
  name = '<unknown>',
): T | never => {
  if (t == null) {
    throw new Error(`Expecting not null for ${name}`);
  }
  return t;
};

type Primitive = string | number | boolean | null | undefined;

// Warn: Not a nested object equals or a deepEquals function
export function objectEquals<T extends Record<string, Primitive>>(a: T, b: T) {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return JSON.stringify(a, keysA.sort()) === JSON.stringify(b, keysB.sort());
}

/**
 * Move an item to the front of an array, if it exists in array.
 * @warning This mutates the array instead of returning a new array.
 */
export function moveToFront<T>(arr: T[], item: T) {
  const index = arr.indexOf(item);
  if (index > 0) {
    const item = arr[index];
    arr.splice(index, 1);
    arr.unshift(item);
  }
}

export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

export const removeQueryParams = (urlString: string) => {
  const url = new URL(urlString);
  return url.origin + url.pathname;
};

export const ensureEnd = (str: string, suffix: string) => {
  return str.endsWith(suffix) ? str : str + suffix;
};

/**
 * Polyfill for `Set.difference()`
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/difference
 */
export function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}

/**
 * Polyfill for `Promise.withResolvers()`
 */
export function withResolvers<T>() {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // @ts-expect-error we know TypeScript!
  return { resolve, reject, promise };
}

export function memoize<T extends () => Promise<unknown>>(
  fn: T,
  options: { maxAge: number; mechanism: 'stale-while-revalidate' | 'max-age' },
): () => ReturnType<T> {
  const { maxAge, mechanism = 'max-age' } = options;

  let lastCall = 0;
  const result: { promise: ReturnType<T> | null } = { promise: null };

  return () => {
    const lastResult = result.promise;
    if (!result.promise || Date.now() - lastCall > maxAge) {
      lastCall = Date.now();
      const promise = fn() as ReturnType<T>;
      promise.catch(() => {
        result.promise = null;
      });
      result.promise = promise;
    }

    if (mechanism === 'stale-while-revalidate' && lastResult) {
      return lastResult;
    }
    return result.promise;
  };
}

export const isOkState = (state: Storage['state']) => {
  return Object.values(state).every((value) => value === false);
};

export type BrowserName = 'chrome' | 'edge' | 'firefox' | 'safari' | 'unknown';

export const getBrowserName = (
  browser: Browser,
  userAgent: string,
): BrowserName => {
  const url = browser.runtime.getURL('');
  if (url.startsWith('moz-extension://')) {
    return 'firefox';
  }
  if (url.startsWith('safari-web-extension://')) {
    return 'safari';
  }
  if (url.startsWith('extension://')) {
    // works only in Playwright?
    return 'edge';
  }

  if (url.startsWith('chrome-extension://')) {
    if (userAgent.includes('Edg/')) {
      return 'edge';
    }
    return 'chrome';
  }
  if (userAgent.includes('Safari/')) {
    return 'safari';
  }

  return 'unknown';
};

/** @see {@linkcode Storage['consent']} */
export const CURRENT_DATA_CONSENT_VERSION: NonNullable<Storage['consent']> = 1;

export function isConsentRequired(userConsentVersion: Storage['consent']) {
  return userConsentVersion !== CURRENT_DATA_CONSENT_VERSION;
}
