import { cx, type CxOptions } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';
import type { useTranslation } from './context';
import type { DeepReadonly } from '@/shared/types';
import type { ErrorWithKeyLike } from '@/shared/helpers';

export const getCurrencySymbol = (assetCode: string): string => {
  if (!isISO4217Code(assetCode)) {
    return assetCode.toUpperCase();
  }
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

export const formatCurrency = (
  value: string | number,
  currency: string,
  maximumFractionDigits = 2,
  locale?: string,
): string => {
  const isCurrencyCode = isISO4217Code(currency);
  const PLACEHOLDER_CURRENCY_CODE = 'ABC';
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: isCurrencyCode ? currency : PLACEHOLDER_CURRENCY_CODE,
    maximumFractionDigits,
  });

  if (isCurrencyCode) {
    return fmt.format(Number(value));
  }
  return fmt
    .formatToParts(Number(value))
    .map((e) => (e.type === 'currency' ? currency.toUpperCase() : e.value))
    .join('');
};

/**
 * Currency identifiers are three-letter uppercase codes defined in ISO 4217.
 * Intl.NumberFormat API allows any 3-letter code to be used without throwing a RangeError.
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf#supported_currency_identifiers
 */
export const isISO4217Code = (code: string): boolean => {
  return code.length === 3;
};

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

export const cn = (...inputs: CxOptions) => {
  return twMerge(cx(inputs));
};

export type ErrorInfo = { message: string; info?: ErrorWithKeyLike };

export function toErrorInfoFactory(t: ReturnType<typeof useTranslation>) {
  return (
    err?: string | DeepReadonly<ErrorWithKeyLike> | null,
  ): ErrorInfo | null => {
    if (!err) return null;
    if (typeof err === 'string') return { message: err };
    // @ts-expect-error readonly, it's ok
    return { message: t(err), info: err };
  };
}
