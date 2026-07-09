import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatCurrency,
  getCurrencySymbol,
  compareSitesByDomain,
} from '@/pages/shared/lib/utils';

describe('compareSitesByDomain', () => {
  const sort = (hostnames: string[]) =>
    [...hostnames].sort(compareSitesByDomain);

  it('sorts root domain before its subdomains', () => {
    expect(sort(['test.sidvishnoi.com', 'sidvishnoi.com'])).toEqual([
      'sidvishnoi.com',
      'test.sidvishnoi.com',
    ]);
    expect(sort(['www.example.com', 'example.com'])).toEqual([
      'example.com',
      'www.example.com',
    ]);
  });

  it('groups subdomains with their root domain', () => {
    expect(
      sort([
        'test.sidvishnoi.com',
        'example.com',
        'www.example.com',
        'sidvishnoi.com',
      ]),
    ).toEqual([
      'example.com',
      'www.example.com',
      'sidvishnoi.com',
      'test.sidvishnoi.com',
    ]);
  });

  it('sorts groups alphabetically by domain', () => {
    expect(sort(['zebra.com', 'apple.com'])).toEqual([
      'apple.com',
      'zebra.com',
    ]);
  });

  it('handles multi-level TLDs (e.g. co.uk)', () => {
    expect(sort(['www.example.co.uk', 'example.co.uk'])).toEqual([
      'example.co.uk',
      'www.example.co.uk',
    ]);
    expect(sort(['foo.co.uk', 'bar.co.uk'])).toEqual([
      'bar.co.uk',
      'foo.co.uk',
    ]);
  });

  it('groups multi-level TLD subdomains together', () => {
    expect(
      sort(['www.foo.co.uk', 'bar.com', 'foo.co.uk', 'www.bar.com']),
    ).toEqual(['bar.com', 'www.bar.com', 'foo.co.uk', 'www.foo.co.uk']);
  });

  it('returns 0 for identical hostnames', () => {
    expect(compareSitesByDomain('example.com', 'example.com')).toBe(0);
  });

  it('sorts by domain name, not TLD', () => {
    expect(sort(['zebra.com', 'apple.xyz'])).toEqual([
      'apple.xyz',
      'zebra.com',
    ]);
  });

  it('uses TLD only as a tiebreaker when domain names are equal', () => {
    expect(sort(['example.xyz', 'example.com'])).toEqual([
      'example.com',
      'example.xyz',
    ]);
  });

  it('sorts subdomains alphabetically within the same root', () => {
    expect(sort(['z.example.com', 'a.example.com', 'example.com'])).toEqual([
      'example.com',
      'a.example.com',
      'z.example.com',
    ]);
  });
});

describe('formatNumber', () => {
  it('should display right format for integers', () => {
    expect(formatNumber(5, 2)).toEqual('5.00');

    expect(formatNumber(5, 4)).toEqual('5.00');

    expect(formatNumber(5, 9)).toEqual('5.00');
  });

  it('should display right format for real numbers bigger than 1', () => {
    expect(formatNumber(5.9, 2)).toEqual('5.90');

    expect(formatNumber(5.09, 4)).toEqual('5.09');

    expect(formatNumber(5.009, 4)).toEqual('5.009');

    expect(formatNumber(5.0009, 4)).toEqual('5.0009');

    expect(formatNumber(5.000_009, 9)).toEqual('5.000009');

    expect(formatNumber(5.000_000_009, 9)).toEqual('5.000000009');
  });

  it('should display right format for real numbers smaller than 1', () => {
    expect(formatNumber(0.09, 2)).toEqual('0.09');

    expect(formatNumber(0.0009, 4)).toEqual('0.0009');

    expect(formatNumber(0.000_000_009, 9)).toEqual('0.000000009');

    expect(formatNumber(0.000_09, 9)).toEqual('0.00009');

    expect(formatNumber(0.000_000_009, 9, true)).toEqual('9e-9');

    expect(formatNumber(0.000_09, 9, true)).toEqual('9e-5');

    expect(formatNumber(0.000_010_9, 9, true)).toEqual('1.09e-5');

    expect(formatNumber(0.000_010_009, 9, true)).toEqual('1.0009e-5');

    expect(formatNumber(0.000_100_009, 9)).toEqual('0.000100009');
  });
});

describe('getCurrencySymbol', () => {
  it('should return currency symbol for common cases', () => {
    expect(getCurrencySymbol('USD')).toEqual('$');
    expect(getCurrencySymbol('EUR')).toEqual('€');
    expect(getCurrencySymbol('MXN')).toEqual('MX$');
  });

  it('should return currency symbol for non-standard currencies', () => {
    expect(getCurrencySymbol('abc')).toEqual('ABC');
    expect(getCurrencySymbol('ZZZ')).toEqual('ZZZ');
    expect(getCurrencySymbol('AB')).toEqual('AB');
    expect(getCurrencySymbol('ABCD')).toEqual('ABCD');
    expect(getCurrencySymbol('ABcDe')).toEqual('ABCDE');
  });
});

describe('formatCurrency', () => {
  it('should display right format for common cases', () => {
    expect(formatCurrency(5, 'USD')).toEqual('$5.00');
    expect(formatCurrency(0.5, 'USD')).toEqual('$0.50');
    expect(formatCurrency(5.34, 'USD')).toEqual('$5.34');
    expect(formatCurrency(5.34, 'EUR')).toEqual('€5.34');
    expect(formatCurrency(5.34, 'MXN')).toEqual('MX$5.34');
  });

  it('should support custom precision', () => {
    expect(formatCurrency(5.12, 'USD', 2)).toEqual('$5.12');
    expect(formatCurrency(5.12, 'USD', 4)).toEqual('$5.12');
    expect(formatCurrency(5.19, 'EUR', 1)).toEqual('€5.2');
    expect(formatCurrency(5.120_58, 'USD', 4)).toEqual('$5.1206');
  });

  it('should display right format in different locales', () => {
    expect(formatCurrency(5.12, 'USD', 2, 'en-US')).toEqual('$5.12');
    expect(formatCurrency(5.12, 'USD', 2, 'en-IN')).toEqual('$5.12');
    expect(formatCurrency(5.34, 'USD', 2, 'fr')).toEqual('5,34\xa0$US'); // '\xa0' is a normal non-breaking space
    expect(formatCurrency(5.45, 'EUR', 2, 'en-US')).toEqual('€5.45');
    expect(formatCurrency(5.67, 'EUR', 2, 'fr-FR')).toEqual('5,67\xa0€');
    expect(formatCurrency(5.89, 'MXN', 2, 'es-MX')).toEqual('$5.89');
  });

  it('should support non-standard currencies', () => {
    expect(formatCurrency(5.12, 'ABC')).toEqual('ABC\xa05.12');
    expect(formatCurrency(5.12, 'ZZZ')).toEqual('ZZZ\xa05.12');
    expect(formatCurrency(5.12, 'AB')).toEqual('AB\xa05.12');
    expect(formatCurrency(5.12, 'ABCDE')).toEqual('ABCDE\xa05.12');
  });
});
