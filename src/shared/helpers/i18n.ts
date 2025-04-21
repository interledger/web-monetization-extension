import type { Browser } from 'webextension-polyfill';
import type Translations from '../../_locales/en/messages.json';

export type TranslationKeys = keyof typeof Translations;

export type ErrorKeys = Extract<
  TranslationKeys,
  `${string}_${'error' | 'warn'}_${string}`
>;

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

export const isErrorWithKey = (err: unknown): err is ErrorWithKeyLike => {
  if (!err || typeof err !== 'object') return false;
  if (err instanceof ErrorWithKey) return true;
  return (
    'key' in err &&
    typeof err.key === 'string' &&
    'substitutions' in err &&
    Array.isArray(err.substitutions)
  );
};

export const errorWithKeyToJSON = (err: ErrorWithKeyLike): ErrorWithKeyLike => {
  const { key, substitutions, cause } = err;
  return { key, substitutions, cause };
};

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
