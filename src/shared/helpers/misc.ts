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

export const isOkState = (state: Storage['state']) => {
  return Object.values(state).every((value) => value === false);
};

export type BrowserName = 'chrome' | 'edge' | 'firefox' | 'unknown';

export const getBrowserName = (
  browser: Browser,
  userAgent: string,
): BrowserName => {
  const url = browser.runtime.getURL('');
  if (url.startsWith('moz-extension://')) {
    return 'firefox';
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

  return 'unknown';
};
