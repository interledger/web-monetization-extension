import React from 'react';
import { Input } from './ui/Input';
import type { WalletAddress } from '@interledger/open-payments';
import { charIsNumber, formatNumber, getCurrencySymbol } from '../lib/utils';
import {
  errorWithKey,
  ErrorWithKeyLike,
  formatCurrency,
  throttle,
} from '@/shared/helpers';

interface Props {
  id: string;
  label: string | React.ReactNode;
  description?: string | React.ReactNode;
  walletAddress: Pick<WalletAddress, 'assetCode' | 'assetScale'>;
  amount: string;
  onChange: (amount: string, inputEl: HTMLInputElement) => void;
  onError: (error: ErrorWithKeyLike) => void;
  className?: string;
  placeholder?: string;
  errorMessage?: string;
  readOnly?: boolean;
  labelHidden?: boolean;
  errorHidden?: boolean;
  min?: number;
  max?: number;
  controls?: boolean;
}

export const InputAmount = ({
  label,
  id,
  walletAddress,
  amount,
  className,
  placeholder,
  errorMessage,
  onChange,
  onError,
  labelHidden,
  errorHidden,
  description,
  min = 0,
  max,
  readOnly,
}: Props) => {
  const currencySymbol = getCurrencySymbol(walletAddress.assetCode);

  const validateAmountOnChange = useThrottle(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const input = ev.target;
      const value = input.value;
      const error = validateAmount(value, walletAddress, min, max);
      if (error) {
        onError(error);
      } else {
        const amountValue = formatNumber(+value, walletAddress.assetScale);
        onChange(amountValue, input);
      }
    },
    350,
    { trailing: true },
  );

  const handleArrowKeys = React.useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      const key = ev.key;
      const assetScale = walletAddress.assetScale;
      if (
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'PageUp' ||
        key === 'PageDown'
      ) {
        ev.preventDefault();
        const input = ev.currentTarget;
        incOrDec(
          input,
          key === 'ArrowUp' || key === 'PageUp' ? 1 : -1,
          ev.shiftKey || /^Page(Up|Down)$/.test(key),
          1 / 10 ** assetScale,
          (value) => formatNumber(value, assetScale),
          (value) => {
            const error = validateAmount(value, walletAddress, min, max);
            if (error) {
              onError(error);
            } else {
              onChange(value, input);
            }
          },
        );
      }
    },
    [onChange, onError, walletAddress, min, max],
  );

  const onKeyDown = React.useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      allowOnlyNumericInput(ev);
      if (!ev.defaultPrevented) {
        handleArrowKeys(ev);
      }
    },
    [handleArrowKeys],
  );

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      label={labelHidden ? null : label}
      aria-label={labelHidden && typeof label === 'string' ? label : undefined}
      description={description}
      placeholder={placeholder}
      className={className}
      defaultValue={amount}
      readOnly={readOnly}
      addOn={<span className="text-weak">{currencySymbol}</span>}
      errorMessage={errorHidden ? '' : errorMessage}
      aria-invalid={errorHidden ? !!errorMessage : false}
      required={true}
      onKeyDown={onKeyDown}
      onChange={validateAmountOnChange}
      onBlur={(ev) => {
        const input = ev.currentTarget;
        const value = input.value;
        if (value === amount && !input.required) {
          return;
        }
        const error = validateAmount(value, walletAddress, min, max);
        if (error) {
          onError(error);
        } else {
          const amountValue = formatNumber(+value, walletAddress.assetScale);
          input.value = amountValue;
          onChange(amountValue, input);
        }
      }}
    />
  );
};

export function validateAmount(
  value: string,
  walletAddress: Pick<WalletAddress, 'assetCode' | 'assetScale'>,
  min: number = 0,
  max?: number,
): null | ErrorWithKeyLike {
  if (!value) {
    return errorWithKey('connectWallet_error_amountRequired');
  }
  const val = Number(value);
  if (Number.isNaN(val)) {
    return errorWithKey('connectWallet_error_amountInvalidNumber');
  }
  if (val <= min) {
    return errorWithKey('connectWallet_error_amountMinimum', [
      formatCurrency(min, walletAddress.assetCode, walletAddress.assetScale),
    ]);
  }
  if (max && val > max) {
    return errorWithKey('connectWallet_error_amountMaximum', [
      formatCurrency(max, walletAddress.assetCode, walletAddress.assetScale),
    ]);
  }
  return null;
}

const useThrottle: typeof throttle = (
  callback,
  delay,
  options = { leading: false, trailing: false },
) => {
  const cbRef = React.useRef(callback);
  React.useEffect(() => {
    cbRef.current = callback;
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(throttle(cbRef.current, delay, options), [delay]);
};

function incOrDec(
  input: HTMLInputElement,
  direction: 1 | -1,
  largeStep: boolean,
  step: number,
  format: (val: number) => string,
  callback: (formattedValue: string, val: number) => void,
) {
  const value = Number(input.value);
  const amount = largeStep ? step * 100 : step;
  const newValue = value + direction * amount;
  const formattedValue = format(newValue);
  input.value = formattedValue;
  callback(formattedValue, newValue);
}

function allowOnlyNumericInput(ev: React.KeyboardEvent<HTMLInputElement>) {
  if (ev.key.length > 1 || ev.ctrlKey || ev.metaKey) return;
  if (
    !charIsNumber(ev.key) ||
    (ev.key === '.' && ev.currentTarget.value.includes('.'))
  ) {
    ev.preventDefault();
  }
}
