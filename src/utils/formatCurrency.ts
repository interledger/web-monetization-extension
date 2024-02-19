export const formatCurrency = (value: any): string => {
  if (value < 1) {
    return `${Math.round(value * 100)}¢`
  } else {
    return `$${parseFloat(value).toFixed(2)}`
  }
}
