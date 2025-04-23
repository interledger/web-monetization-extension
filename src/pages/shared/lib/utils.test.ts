import {
  formatNumber,
  formatCurrency,
  getCurrencySymbol,
} from '@/pages/shared/lib/utils';

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

    expect(formatNumber(5.000009, 9)).toEqual('5.000009');

    expect(formatNumber(5.000000009, 9)).toEqual('5.000000009');
  });

  it('should display right format for real numbers smaller than 1', () => {
    expect(formatNumber(0.09, 2)).toEqual('0.09');

    expect(formatNumber(0.0009, 4)).toEqual('0.0009');

    expect(formatNumber(0.000000009, 9)).toEqual('0.000000009');

    expect(formatNumber(0.00009, 9)).toEqual('0.00009');

    expect(formatNumber(0.000000009, 9, true)).toEqual('9e-9');

    expect(formatNumber(0.00009, 9, true)).toEqual('9e-5');

    expect(formatNumber(0.0000109, 9, true)).toEqual('1.09e-5');

    expect(formatNumber(0.000010009, 9, true)).toEqual('1.0009e-5');

    expect(formatNumber(0.000100009, 9)).toEqual('0.000100009');
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
    expect(formatCurrency(5.12058, 'USD', 4)).toEqual('$5.1206');
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
