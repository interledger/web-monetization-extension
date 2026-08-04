import { describe, expect, it } from 'vitest';
import {
  ErrorWithKey,
  errorWithKey,
  errorWithKeyToJSON,
  isErrorWithKey,
  tFactory,
} from '../helpers/i18n';
import {
  asBrowser,
  makeBrowser,
} from '@/background/services/__tests__/helpers';

describe('errorWithKey / ErrorWithKey', () => {
  it('errorWithKey creates a plain object with key, substitutions and cause', () => {
    const result = errorWithKey('disconnectWallet_error', ['oops']);
    expect(result).toEqual({
      key: 'disconnectWallet_error',
      substitutions: ['oops'],
      cause: undefined,
    });
  });

  it('ErrorWithKey is an Error instance carrying key/substitutions/cause', () => {
    const cause = errorWithKey('disconnectWallet_error', ['inner']);
    const err = new ErrorWithKey('disconnectWallet_error', ['outer'], cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.key).toBe('disconnectWallet_error');
    expect(err.substitutions).toEqual(['outer']);
    expect(err.cause).toBe(cause);
  });

  it('defaults substitutions to an empty array', () => {
    const err = new ErrorWithKey('disconnectWallet_error');
    expect(err.substitutions).toEqual([]);
  });
});

describe('isErrorWithKey', () => {
  it('returns true for ErrorWithKey instances', () => {
    expect(isErrorWithKey(new ErrorWithKey('disconnectWallet_error'))).toBe(
      true,
    );
  });

  it('returns true for plain objects shaped like ErrorWithKeyLike', () => {
    expect(isErrorWithKey(errorWithKey('disconnectWallet_error', ['x']))).toBe(
      true,
    );
  });

  it('returns false for non-matching values', () => {
    expect(isErrorWithKey(new Error('plain'))).toBe(false);
    expect(isErrorWithKey(null)).toBe(false);
    expect(isErrorWithKey(undefined)).toBe(false);
    expect(isErrorWithKey('string')).toBe(false);
    expect(isErrorWithKey({ key: 'x' })).toBe(false);
    expect(isErrorWithKey({ substitutions: [] })).toBe(false);
  });
});

describe('errorWithKeyToJSON', () => {
  it('picks only key, substitutions and cause', () => {
    const cause = errorWithKey('disconnectWallet_error', ['b']);
    const err = new ErrorWithKey('disconnectWallet_error', ['a'], cause);
    expect(errorWithKeyToJSON(err)).toEqual({
      key: 'disconnectWallet_error',
      substitutions: ['a'],
      cause,
    });
  });
});

describe('tFactory', () => {
  it('delegates to browser.i18n.getMessage for string keys', () => {
    const browser = makeBrowser();
    const t = tFactory(asBrowser(browser));
    expect(t('appDescription')).toBe('appDescription');
    expect(browser.i18n.getMessage).toHaveBeenCalledWith(
      'appDescription',
      undefined,
    );
  });

  it('passes substitutions through for string keys', () => {
    const browser = makeBrowser();
    const t = tFactory(asBrowser(browser));
    t('disconnectWallet_error', ['oops']);
    expect(browser.i18n.getMessage).toHaveBeenCalledWith(
      'disconnectWallet_error',
      ['oops'],
    );
  });

  it('supports being called with an ErrorWithKeyLike object', () => {
    const browser = makeBrowser();
    const t = tFactory(asBrowser(browser));
    t(errorWithKey('disconnectWallet_error', ['x']));
    expect(browser.i18n.getMessage).toHaveBeenCalledWith(
      'disconnectWallet_error',
      ['x'],
    );
  });
});
