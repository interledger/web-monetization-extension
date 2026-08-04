import { describe, expect, it } from 'vitest';
import type { Browser } from 'webextension-polyfill';
import {
  CURRENT_DATA_CONSENT_VERSION,
  ensureEnd,
  getBrowserName,
  isConsentRequired,
  isNotNull,
  notNullOrUndef,
} from '../helpers/misc';

describe('notNullOrUndef', () => {
  it('returns the value when it is not null/undefined', () => {
    expect(notNullOrUndef(5)).toBe(5);
    expect(notNullOrUndef('a')).toBe('a');
    expect(notNullOrUndef(0)).toBe(0);
  });

  it('throws when the value is null or undefined', () => {
    expect(() => notNullOrUndef(null, 'foo')).toThrow(
      'Expecting not null for foo',
    );
    expect(() => notNullOrUndef(undefined)).toThrow(
      'Expecting not null for <unknown>',
    );
  });
});

describe('isNotNull', () => {
  it('filters out null values while keeping falsy-but-defined ones', () => {
    const arr = [1, null, 0, null, 3];
    expect(arr.filter(isNotNull)).toEqual([1, 0, 3]);
  });
});

describe('ensureEnd', () => {
  it('appends the suffix when missing', () => {
    expect(ensureEnd('foo', '/')).toBe('foo/');
  });

  it('leaves the string unchanged when the suffix is already present', () => {
    expect(ensureEnd('foo/', '/')).toBe('foo/');
  });
});

describe('getBrowserName', () => {
  const makeBrowser = (urlPrefix: string) =>
    ({ runtime: { getURL: () => urlPrefix } }) as unknown as Browser;

  it('detects firefox', () => {
    expect(
      getBrowserName(makeBrowser('moz-extension://id/'), 'Mozilla/5.0'),
    ).toBe('firefox');
  });

  it('detects safari via its extension url scheme', () => {
    expect(
      getBrowserName(makeBrowser('safari-web-extension://id/'), 'Mozilla/5.0'),
    ).toBe('safari');
  });

  it('detects edge via the playwright-style extension url', () => {
    expect(getBrowserName(makeBrowser('extension://id/'), 'Mozilla/5.0')).toBe(
      'edge',
    );
  });

  it('detects edge via chrome-extension url + Edg/ user agent', () => {
    expect(
      getBrowserName(
        makeBrowser('chrome-extension://id/'),
        'Mozilla/5.0 Edg/120.0',
      ),
    ).toBe('edge');
  });

  it('detects chrome via chrome-extension url without Edg/ in the user agent', () => {
    expect(
      getBrowserName(
        makeBrowser('chrome-extension://id/'),
        'Mozilla/5.0 Chrome/120.0',
      ),
    ).toBe('chrome');
  });

  it('falls back to safari when the user agent contains Safari/', () => {
    expect(
      getBrowserName(makeBrowser('unknown://id/'), 'Mozilla/5.0 Safari/605.1'),
    ).toBe('safari');
  });

  it('falls back to unknown otherwise', () => {
    expect(getBrowserName(makeBrowser('unknown://id/'), 'Mozilla/5.0')).toBe(
      'unknown',
    );
  });
});

describe('isConsentRequired', () => {
  it('is required when the version differs from the current one', () => {
    expect(isConsentRequired(undefined)).toBe(true);
    expect(isConsentRequired(1)).toBe(true);
  });

  it('is not required when the version matches the current one', () => {
    expect(isConsentRequired(CURRENT_DATA_CONSENT_VERSION)).toBe(false);
  });
});
