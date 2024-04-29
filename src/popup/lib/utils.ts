import browser from 'webextension-polyfill';

export const getCurrencySymbol = (assetCode: string): string => {
  return new Intl.NumberFormat('en-US', {
    currency: assetCode,
    style: 'currency',
    currencyDisplay: 'symbol',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  })
    .format(0)
    .replace(/0/g, '')
    .trim()
}

export const transformBalance = (amount: string, scale: number): string => {
  const value = BigInt(amount)
  const divisor = BigInt(10 ** scale)

  const integerPart = (value / divisor).toString()
  const fractionalPart = (value % divisor).toString().padStart(scale, '0')

  return `${integerPart}.${fractionalPart}`
}

export function charIsNumber(char?: string) {
  return !!(char || '').match(/\d|\./)
}

export function roundWithPrecision(num: number, precision: number) {
  const multiplier = Math.pow(10, precision)
  return Math.round(num * multiplier) / multiplier
}
