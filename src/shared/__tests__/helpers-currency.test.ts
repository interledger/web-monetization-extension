import { describe, expect, it } from 'vitest';
import { transformBalance } from '../helpers/currency';

describe('transformBalance', () => {
  it('formats a bigint/string amount at the given scale', () => {
    expect(transformBalance('12345', 2)).toBe('123.45');
    expect(transformBalance(12345n, 2)).toBe('123.45');
    expect(transformBalance('5', 2)).toBe('0.05');
    expect(transformBalance('100', 0)).toBe('100.0');
  });
});
