export const getCurrencySymbol = (assetCode: string): string => {
  return new Intl.NumberFormat('en-US', {
    currency: assetCode,
    style: 'currency',
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
    .format(0)
    .replace(/0/g, '')
    .trim();
};

export function charIsNumber(char?: string) {
  return !!(char || '').match(/\d|\./);
}

export function roundWithPrecision(num: number, precision: number) {
  const multiplier = 10 ** precision;
  return Math.round(num * multiplier) / multiplier;
}

export function formatNumber(
  value: number,
  scale: number,
  allowExponential = false,
): string {
  // TO DO: handle scale 0

  if (!value) return '0.00';
  // to avoid floating point issues on multiplication
  const pow2 = +(value * 100).toFixed(9);
  const pow4 = +(value * 10 ** 4).toFixed(9);

  if (scale <= 2 || (pow2 >= 1 && pow2 - Math.floor(pow2) === 0)) {
    return value.toFixed(2);
  } else if (scale >= 3 && scale <= 4) {
    return value.toString();
  } else {
    if (pow4 >= 1 || !allowExponential) {
      let fixedScale = 5;
      let powN = +(value * 10 ** fixedScale).toFixed(9);
      while (powN - Math.floor(powN) > 0 && fixedScale < scale) {
        ++fixedScale;
        powN = +(value * 10 ** fixedScale).toFixed(9);
      }

      return value.toFixed(fixedScale);
    } else return value.toExponential();
  }
}

export function toWalletAddressUrl(s: string): string {
  return s.startsWith('$') ? s.replace('$', 'https://') : s;
}
