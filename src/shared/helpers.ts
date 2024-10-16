import type { SuccessResponse } from '@/shared/messages';
import type { WalletAddress, JWKS } from '@interledger/open-payments';
import { cx, CxOptions } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';
import { addSeconds } from 'date-fns/addSeconds';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { parse, toSeconds } from 'iso8601-duration';
import type { Browser } from 'webextension-polyfill';
import type { Storage, RepeatingInterval, AmountValue } from './types';

export type TranslationKeys =
  keyof typeof import('../_locales/en/messages.json');

export type ErrorKeys = Extract<TranslationKeys, `${string}_error_${string}`>;

export const cn = (...inputs: CxOptions) => {
  return twMerge(cx(inputs));
};

export const formatCurrency = (
  value: string | number,
  currency: string,
  maximumFractionDigits = 2,
  locale?: string,
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(Number(value));
};

const isWalletAddress = (o: any): o is WalletAddress => {
  return (
    o.id &&
    typeof o.id === 'string' &&
    o.assetScale &&
    typeof o.assetScale === 'number' &&
    o.assetCode &&
    typeof o.assetCode === 'string' &&
    o.authServer &&
    typeof o.authServer === 'string' &&
    o.resourceServer &&
    typeof o.resourceServer === 'string'
  );
};

export const getWalletInformation = async (
  walletAddressUrl: string,
): Promise<WalletAddress> => {
  const response = await fetch(walletAddressUrl, {
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('This wallet address does not exist.');
    }
    throw new Error('Failed to fetch wallet address.');
  }

  const msgInvalidWalletAddress = `Provided URL is not a valid wallet address.`;
  const json = await response.json().catch((error) => {
    throw new Error(msgInvalidWalletAddress, { cause: error });
  });
  if (!isWalletAddress(json)) {
    throw new Error(msgInvalidWalletAddress);
  }

  return json;
};

export const getJWKS = async (walletAddressUrl: string) => {
  const jwksUrl = new URL('jwks.json', ensureEnd(walletAddressUrl, '/'));
  const res = await fetch(jwksUrl.href);
  const json = await res.json();
  return json as JWKS;
};

/**
 * Error object with key and substitutions based on `_locales/[lang]/messages.json`
 */
export interface ErrorWithKeyLike<T extends ErrorKeys = ErrorKeys> {
  key: Extract<ErrorKeys, T>;
  // Could be empty, but required for checking if an object follows this interface
  substitutions: string[];
  cause?: ErrorWithKeyLike;
}

export class ErrorWithKey<T extends ErrorKeys = ErrorKeys>
  extends Error
  implements ErrorWithKeyLike<T>
{
  constructor(
    public readonly key: ErrorWithKeyLike<T>['key'],
    public readonly substitutions: ErrorWithKeyLike<T>['substitutions'] = [],
    public readonly cause?: ErrorWithKeyLike,
  ) {
    super(key, { cause });
  }
}

/**
 * Same as {@linkcode ErrorWithKey} but creates plain object instead of Error
 * instance.
 * Easier than creating object ourselves, but more performant than Error.
 */
export const errorWithKey = <T extends ErrorKeys = ErrorKeys>(
  key: ErrorWithKeyLike<T>['key'],
  substitutions: ErrorWithKeyLike<T>['substitutions'] = [],
  cause?: ErrorWithKeyLike,
) => ({ key, substitutions, cause });

export const isErrorWithKey = (err: any): err is ErrorWithKeyLike => {
  if (!err || typeof err !== 'object') return false;
  return (
    err instanceof ErrorWithKey ||
    (typeof err.key === 'string' && Array.isArray(err.substitutions))
  );
};

export const errorWithKeyToJSON = (err: ErrorWithKeyLike): ErrorWithKeyLike => {
  const { key, substitutions, cause } = err;
  return { key, substitutions, cause };
};

export const success = <TPayload = undefined>(
  payload: TPayload,
): SuccessResponse<TPayload> => ({
  success: true,
  payload,
});

export const failure = (message: string | ErrorWithKeyLike) => ({
  success: false as const,
  ...(typeof message === 'string'
    ? { message }
    : { error: message, message: message.key }),
});

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const notNullOrUndef = <T>(
  t: T | null | undefined,
  name = '<unknown>',
): T | never => {
  if (t == null) {
    throw new Error(`Expecting not null for ${name}`);
  } else {
    return t;
  }
};

export function debounceAsync<T extends unknown[], R extends Promise<unknown>>(
  func: (...args: T) => R,
  wait: number,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: T) {
    return new Promise<Awaited<R>>((resolve) => {
      if (timeout != null) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        void Promise.resolve(func(...args)).then(resolve);
      }, wait);
    });
  };
}

// Based on https://stackoverflow.com/a/27078401
export function throttle<T extends unknown[], R>(
  func: (...args: T) => R,
  wait: number,
  options: Partial<{ leading: boolean; trailing: boolean }> = {
    leading: false,
    trailing: false,
  },
) {
  let result: R;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let previous = 0;
  const later = (...args: T) => {
    previous = options.leading === false ? 0 : Date.now();
    timeout = null;
    result = func(...args);
  };
  return (...args: T) => {
    const now = Date.now();
    if (!previous && options.leading === false) previous = now;
    const remaining = wait - (now - previous);
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func(...args);
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining, ...args);
    }
    return result;
  };
}

/**
 * Throttle a function, while allowing the queued arguments to be reduced before
 * the function is called. With args reducer, we can call the throttled function
 * with first/last/merged arguments etc.
 *
 * @example
 * ```ts
 * const throttled = new ThrottleBatch(
 *   (total: number) => saveToStorage({ total: total.toString() }),
 *   (collectedArgs) => [collectedArgs.reduce(total, [val] => total + val, 0)],
 *   wait
 * )
 * throttled.enqueue(10)
 * throttled.enqueue(15)
 * // results in saveToStorage(25)
 * ```
 */
export class ThrottleBatch<Args extends unknown[], R = unknown> {
  private argsList: Args[] = [];
  private throttled: () => void;

  constructor(
    private func: (...arg: Args) => R,
    private argsReducer: (args: Args[]) => [...Args],
    wait: number,
  ) {
    this.throttled = throttle(() => this.flush(), wait, { leading: true });
  }

  enqueue(...data: Args) {
    this.argsList.push(data);
    void this.throttled();
  }

  flush() {
    if (!this.argsList.length) return;
    const args = this.argsReducer(this.argsList.slice());
    this.argsList = [];
    return this.func(...args);
  }
}

export function debounceSync<T extends unknown[], R>(
  func: (...args: T) => R,
  wait: number,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: T) {
    return new Promise<R>((resolve) => {
      if (timeout != null) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        resolve(func(...args));
      }, wait);
    });
  };
}

export function convert(value: bigint, source: number, target: number) {
  const scaleDiff = target - source;
  if (scaleDiff > 0) {
    return value * BigInt(Math.pow(10, scaleDiff));
  }
  return value / BigInt(Math.pow(10, -scaleDiff));
}

export function bigIntMax<T extends bigint | AmountValue>(a: T, b: T): T {
  return BigInt(a) > BigInt(b) ? a : b;
}

export type Translation = ReturnType<typeof tFactory>;
export function tFactory(browser: Pick<Browser, 'i18n'>) {
  /**
   * Helper over calling cumbersome `this.browser.i18n.getMessage(key)` with
   * added benefit that it type-checks if key exists in message.json
   */
  function t<T extends TranslationKeys>(
    key: T,
    substitutions?: string[],
  ): string;
  function t<T extends ErrorKeys>(err: ErrorWithKeyLike<T>): string;
  function t(key: string | ErrorWithKeyLike, substitutions?: string[]): string {
    if (typeof key === 'string') {
      return browser.i18n.getMessage(key, substitutions);
    }
    const err = key;
    return browser.i18n.getMessage(err.key, err.substitutions);
  }
  return t;
}

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
  let reject: (reason?: any) => void;
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

const REPEATING_INTERVAL_REGEX =
  /^R(\d*)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\/(P.+)$/;

export const getNextOccurrence = (
  interval: RepeatingInterval,
  base = new Date(),
): Date => {
  const match = interval.match(REPEATING_INTERVAL_REGEX);
  if (!match) {
    throw new Error(`Invalid interval: ${interval}`);
  }
  const count = match[1] ? parseInt(match[1], 10) : null;
  const startDate = new Date(match[2]);
  const pattern = parse(match[3]);
  const seconds = toSeconds(pattern, base);

  if (count && isAfter(base, addSeconds(startDate, count * seconds))) {
    throw new Error('No next occurrence is possible beyond given time');
  }

  let date = new Date(startDate);
  while (!isBefore(base, date)) {
    date = addSeconds(date, seconds);
  }

  return date;
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
