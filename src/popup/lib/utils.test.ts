import { formatNumber, toWalletAddressUrl } from './utils';

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

describe('toWalletAddressUrl', () => {
  it('converts from short form to long form', () => {
    expect(toWalletAddressUrl('$wallet.com/bob')).toEqual(
      'https://wallet.com/bob',
    );
  });
});
