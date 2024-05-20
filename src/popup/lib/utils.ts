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

export function formatNumber(
  value: number,
  scale: number,
  allowExponential = false
): string {
  if (
    scale <= 2 ||
    (value * 100 >= 1 && value * 100 - Math.floor(value * 100) === 0)
  ) {
    return value.toFixed(2).toString()
  } else if (scale >= 3 && scale <= 4) {
    return value.toString()
  } else {
    if (value * 10 ** 4 >= 1 || !allowExponential) {
      let fixedScale = 5
      while (
        value * 10 ** fixedScale - Math.floor(value * 10 ** fixedScale) > 0 &&
        fixedScale < scale
      ) {
        ++fixedScale
      }
      return value.toFixed(fixedScale).toString()
    } else return value.toExponential()
  }
}
