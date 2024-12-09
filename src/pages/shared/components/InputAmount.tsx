import React from 'react';
import { Input } from './ui/Input';
import type { WalletAddress } from '@interledger/open-payments';
import { charIsNumber, formatNumber, getCurrencySymbol } from '../lib/utils';
import {
  errorWithKey,
  ErrorWithKeyLike,
  formatCurrency,
} from '@/shared/helpers';
import { useLongPress, useThrottle } from '@/pages/shared/lib/hooks';

interface Props {
  id: string;
  label: string | React.ReactNode;
  description?: string | React.ReactNode;
  walletAddress: Pick<WalletAddress, 'assetCode' | 'assetScale'>;
  amount: string;
  onChange: (amount: string, inputEl: HTMLInputElement) => void;
  onError: (error: ErrorWithKeyLike) => void;
  className?: string;
  wrapperClassName?: string;
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
  wrapperClassName,
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
  controls = false,
}: Props) => {
  const { assetScale } = walletAddress;
  const step = 1 / 10 ** assetScale;
  const currencySymbol = getCurrencySymbol(walletAddress.assetCode);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const formatAmount = React.useCallback(
    (value: number) => formatNumber(value, assetScale),
    [assetScale],
  );

  const handleValue = React.useCallback(
    (value: string, skipSetValue = false) => {
      const error = validateAmount(value, walletAddress, min, max);
      if (error) {
        onError(error);
      } else {
        const input = inputRef.current!;
        const formattedValue = formatAmount(+value);
        if (!skipSetValue) {
          input.value = formattedValue;
        }
        onChange(formattedValue, input);
      }
    },
    [walletAddress, onChange, onError, formatAmount, min, max],
  );

  const validateAmountOnChange = useThrottle(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      handleValue(ev.target.value, true);
    },
    350,
    { trailing: true },
  );

  const handleArrowKeys = React.useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      const key = ev.key;
      if (
        key !== 'ArrowUp' &&
        key !== 'ArrowDown' &&
        key !== 'PageUp' &&
        key !== 'PageDown'
      ) {
        return;
      }

      ev.preventDefault();
      const input = ev.currentTarget;
      const isLargeStep = ev.shiftKey || /^Page(Up|Down)$/.test(key);
      const direction = key === 'ArrowUp' || key === 'PageUp' ? 1 : -1;
      const amount = isLargeStep ? step * 100 : step;
      incOrDec(input, direction, amount, formatAmount, handleValue, min, max);
    },
    [formatAmount, handleValue, step, min, max],
  );

  const onKeyDown = React.useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      allowOnlyNumericInput(ev);
      if (!ev.defaultPrevented) {
        if (readOnly || !controls) return;
        handleArrowKeys(ev);
      }
    },
    [handleArrowKeys, readOnly, controls],
  );

  const controlInc = React.useCallback(() => {
    incOrDec(inputRef.current!, 1, step, formatAmount, handleValue, min, max);
  }, [step, formatAmount, handleValue, min, max]);
  const controlDec = React.useCallback(() => {
    incOrDec(inputRef.current!, -1, step, formatAmount, handleValue, min, max);
  }, [step, formatAmount, handleValue, min, max]);

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      ref={inputRef}
      label={labelHidden ? null : label}
      aria-label={labelHidden && typeof label === 'string' ? label : undefined}
      description={description}
      placeholder={placeholder}
      className={className}
      wrapperClassName={wrapperClassName}
      defaultValue={amount}
      readOnly={readOnly}
      leadingAddOn={<span className="text-weak">{currencySymbol}</span>}
      trailingAddOn={
        controls ? (
          <Controls readOnly={readOnly} inc={controlInc} dec={controlDec} />
        ) : null
      }
      role={controls ? 'spinbutton' : undefined}
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
        handleValue(value);
      }}
    />
  );
};

/**
 * If a re-render is triggered, our long-press logic on inc/dec controls (i.e.
 * when `controls == true`) will break (we stop on unMount). So, we memoize this
 * component based on some props.
 */
export const InputAmountMemoized = React.memo(InputAmount, (prev, next) => {
  return (
    prev.min === next.min &&
    prev.max === next.max &&
    prev.controls === next.controls &&
    prev.readOnly === next.readOnly &&
    prev.errorMessage === next.errorMessage
  );
});

function Controls({
  readOnly = false,
  inc,
  dec,
}: {
  readOnly?: boolean;
  inc: () => void;
  dec: () => void;
}) {
  const Button = ({
    onClick,
    icon,
  }: {
    onClick: () => void;
    icon: React.ReactNode;
  }) => {
    const longPress = useLongPress(onClick);
    return (
      <button
        className="cursor-pointer p-1 text-lg text-weak outline-none hover:bg-gray-50 hover:text-strong disabled:cursor-default disabled:text-weak disabled:hover:bg-transparent"
        type="button"
        tabIndex={-1}
        aria-hidden={true}
        disabled={readOnly}
        onClick={onClick}
        {...longPress}
      >
        <svg
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3"
        >
          {icon}
        </svg>
      </button>
    );
  };

  return (
    <div
      className="flex flex-col items-center justify-center"
      aria-hidden={true}
      tabIndex={-1}
    >
      <Button onClick={inc} icon={<path d="m4.5 15.75 7.5-7.5 7.5 7.5" />} />
      <Button onClick={dec} icon={<path d="m19.5 8.25-7.5 7.5-7.5-7.5" />} />
    </div>
  );
}

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
  if (val < min) {
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

function incOrDec(
  input: HTMLInputElement,
  direction: 1 | -1,
  step: number,
  format: (val: number) => string,
  callback: (formattedValue: string) => void,
  min: number = 0,
  max?: number,
) {
  const value = Number(input.value);
  let newValue = value + direction * step;
  if (newValue < min) {
    newValue = min;
  } else if (max && newValue > max) {
    newValue = max;
  }
  if (newValue === value) return;
  const formattedValue = format(newValue);
  input.value = formattedValue;
  callback(formattedValue);
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
