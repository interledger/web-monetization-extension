import React from 'react';
import { Input } from './ui/Input';
import type { WalletAddress } from '@interledger/open-payments';
import { charIsNumber, formatNumber, getCurrencySymbol } from '../lib/utils';
import {
  errorWithKey,
  ErrorWithKeyLike,
  formatCurrency,
} from '@/shared/helpers';

interface Props {
  id: string;
  label: string;
  walletAddress: Pick<WalletAddress, 'assetCode' | 'assetScale'>;
  amount: string;
  onChange: (amount: string, inputEl: HTMLInputElement) => void;
  onError: (error: ErrorWithKeyLike) => void;
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
  errorMessage,
  onChange,
  onError,
  labelHidden,
  errorHidden,
  min = 0,
  max,
  readOnly,
}: Props) => {
  const currencySymbol = getCurrencySymbol(walletAddress.assetCode);
  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      label={labelHidden ? null : label}
      aria-label={labelHidden ? label : undefined}
      placeholder="5.00"
      className="max-w-32"
      defaultValue={amount}
      readOnly={readOnly}
      addOn={<span className="text-weak">{currencySymbol}</span>}
      errorMessage={errorHidden ? '' : errorMessage}
      aria-invalid={errorHidden ? !!errorMessage : false}
      required={true}
      onKeyDown={allowOnlyNumericInput}
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
  _max?: number,
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
  return null;
}

function allowOnlyNumericInput(ev: React.KeyboardEvent<HTMLInputElement>) {
  if (
    (!charIsNumber(ev.key) &&
      ev.key !== 'Backspace' &&
      ev.key !== 'Delete' &&
      ev.key !== 'Enter' &&
      ev.key !== 'Tab') ||
    (ev.key === '.' && ev.currentTarget.value.includes('.'))
  ) {
    ev.preventDefault();
  }
}
