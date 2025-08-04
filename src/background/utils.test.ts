/// <reference types="jest-expect-message" />
import {
  convertWithExchangeRate,
  getNextSendableAmount,
  isSecureContext,
} from './utils';

// same as BuiltinIterator.take(n)
function take<T>(iter: IterableIterator<T>, n: number) {
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    const item = iter.next();
    if (item.done) break;
    result.push(item.value);
  }
  return result;
}

describe('getNextSendableAmount', () => {
  it('from assetScale 8 to 9', () => {
    const min = 990_00_000n / 3600n; // 0.99XPR per hour == 0.000275 XRP per second (27500 at scale 8)
    expect(take(getNextSendableAmount(8, 9, min), 8)).toEqual([
      '27500',
      '27501',
      '27502',
      '27504',
      '27508',
      '27515',
      '27527',
      '27547',
    ]);
  });

  it('from assetScale 8 to 2', () => {
    const min = 990_00_000n / 3600n;
    expect(take(getNextSendableAmount(8, 2, min), 8)).toEqual([
      '27500',
      '1027500',
      '2027500',
      '4027500',
      '8027500',
      '15027500',
      '27027500',
      '47027500',
    ]);
  });

  it('from assetScale 3 to 2', () => {
    expect(take(getNextSendableAmount(3, 2), 8)).toEqual([
      '10',
      '20',
      '40',
      '80',
      '150',
      '270',
      '470',
      '800',
    ]);
  });

  it('from assetScale 2 to 3', () => {
    expect(take(getNextSendableAmount(2, 3), 8)).toEqual([
      '1',
      '2',
      '4',
      '8',
      '15',
      '27',
      '47',
      '80',
    ]);
  });

  it('from assetScale 2 to 2', () => {
    expect(take(getNextSendableAmount(2, 2), 8)).toEqual([
      '1',
      '2',
      '4',
      '8',
      '15',
      '27',
      '47',
      '80',
    ]);
  });
});

describe('convertWithExchangeRate', () => {
  const exchangeRates = {
    base: 'USD',
    rates: {
      BTC: 96_048.49, // very large rate
      CAD: 0.7, // close rate, lower
      EUR: 1.04, // close rate, larger; common case
      GBP: 1.24,
      JPY: 0.0065, // small rate, different assetScale?
      LTC: 117.04, // large-ish rate
      MXN: 0.0486, // common case
      RON: 0.21,
      SHIB: 0.000_015_89, // very small rate
      USD: 1, // base, very common case
      ZAR: 0.05, // small rate; common case
    },
  };

  const CASES = [
    {
      name: 'between same currency',
      from: 'USD',
      to: 'USD',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '10' },
        { input: '100', expected: '100' },
        { input: '10000', expected: '10000' },
        { input: '15', expected: '15' },
        { input: '2', expected: '2' },
        { input: '200', expected: '200' },
        { input: 200n, expected: 200n },
      ],
    },
    {
      name: 'from weaker currency',
      from: 'USD',
      to: 'GBP',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '8' },
        { input: '100', expected: '81' },
        { input: '10000', expected: '8065' },
        { input: '15', expected: '12' },
        { input: '2', expected: '2' },
        { input: '200', expected: '161' },
      ],
    },
    {
      name: 'from slightly weaker currency',
      from: 'USD',
      to: 'EUR',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '10' },
        { input: '100', expected: '96' },
        { input: '10000', expected: '9615' },
        { input: '15', expected: '14' },
        { input: '2', expected: '2' },
        { input: '200', expected: '192' },
        { input: 200n, expected: 192n },
      ],
    },
    {
      name: 'from stronger currency',
      from: 'USD',
      to: 'MXN',
      amounts: [
        { input: '1', expected: '21' },
        { input: '10', expected: '206' },
        { input: '100', expected: '2058' },
        { input: '10000', expected: '205761' },
        { input: '15', expected: '309' },
        { input: '2', expected: '41' },
        { input: '200', expected: '4115' },
        { input: 200n, expected: 4115n },
      ],
    },
    {
      name: 'from much stronger currency',
      from: 'USD',
      to: 'ZAR',
      amounts: [
        { input: '1', expected: '20' },
        { input: '10', expected: '200' },
        { input: '100', expected: '2000' },
        { input: '10000', expected: '200000' },
        { input: '15', expected: '300' },
        { input: '2', expected: '40' },
        { input: '200', expected: '4000' },
        { input: 200n, expected: 4000n },
      ],
    },
    {
      name: 'with different base currency',
      from: 'GBP',
      to: 'USD',
      amounts: [
        { input: '1', expected: '1' },
        { input: '10', expected: '12' },
        { input: '100', expected: '124' },
        { input: '10000', expected: '12400' },
        { input: '15', expected: '19' },
        { input: '2', expected: '2' },
        { input: '200', expected: '248' },
      ],
    },
    {
      name: 'with different assetScale (2 -> 3)',
      from: 'USD',
      to: 'JPY',
      toAssetScale: 3,
      amounts: [
        { input: '1', expected: '1538' },
        { input: '10', expected: '15385' },
        { input: '100', expected: '153846' },
        { input: '10000', expected: '15384615' },
        { input: '15', expected: '23077' },
        { input: '2', expected: '3077' },
        { input: '200', expected: '307692' },
      ],
    },
  ];

  it.each(CASES)('$name', (testCase) => {
    const from = {
      assetScale: 2,
      assetCode: testCase.from,
    };
    const to = {
      assetScale: testCase.toAssetScale ?? 2,
      assetCode: testCase.to,
    };
    for (const { input, expected } of testCase.amounts) {
      expect(
        convertWithExchangeRate(input, from, to, exchangeRates),
        `input: ${input} ${from.assetCode}, expected: ${expected} ${to.assetCode}`,
      ).toBe(expected);
    }
  });
});

describe('isSecureContext', () => {
  it('returns true for https:// URLs', () => {
    expect(isSecureContext('https://example.com')).toBe(true);
    expect(isSecureContext('https://example.com/foo')).toBe(true);

    expect(isSecureContext('https://localhost')).toBe(true);
    expect(isSecureContext('https://localhost:4000')).toBe(true);

    expect(isSecureContext('https://127.0.0.1')).toBe(true);
    expect(isSecureContext('https://127.0.0.1:3000')).toBe(true);
  });

  it('returns true for localhost URLs', () => {
    expect(isSecureContext('http://localhost')).toBe(true);
    expect(isSecureContext('http://localhost:4000')).toBe(true);
    expect(isSecureContext('http://example.localhost')).toBe(true);
    expect(isSecureContext('http://example.localhost:5000')).toBe(true);

    expect(isSecureContext('http://127.0.0.1:3000')).toBe(true);
    expect(isSecureContext('http://127.0.0.1')).toBe(true);
  });

  it('returns false for everything else', () => {
    expect(isSecureContext('http://example.com')).toBe(false);
    expect(isSecureContext('http://example.com/foo')).toBe(false);

    // Not supported for our use case
    expect(isSecureContext('wss://example.com')).toBe(false);
    expect(isSecureContext('file:///users/sid')).toBe(false);
  });
});
