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
      const largeStep = ev.shiftKey || /^Page(Up|Down)$/.test(key);
      const direction = key === 'ArrowUp' || key === 'PageUp' ? 1 : -1;
      incOrDec(
        input,
        direction,
        largeStep ? step * 100 : step,
        formatAmount,
        handleValue,
      );
    },
    [formatAmount, handleValue, step],
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
      ref={inputRef}
      label={labelHidden ? null : label}
      aria-label={labelHidden && typeof label === 'string' ? label : undefined}
      description={description}
      placeholder={placeholder}
      className={className}
      defaultValue={amount}
      readOnly={readOnly}
      addOn={<span className="text-weak">{currencySymbol}</span>}
      addOnRight={
        controls ? (
          <Controls
            inc={() =>
              incOrDec(inputRef.current!, 1, step, formatAmount, handleValue)
            }
            dec={() =>
              incOrDec(inputRef.current!, -1, step, formatAmount, handleValue)
            }
          />
        ) : null
      }
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
    prev.errorMessage === next.errorMessage
  );
});

function Controls({ inc, dec }: { inc: () => void; dec: () => void }) {
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
        className="p-1 text-lg text-weak outline-none hover:bg-gray-50 hover:text-strong"
        type="button"
        tabIndex={-1}
        aria-hidden={true}
        {...longPress}
      >
        <svg
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
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
      <Button onClick={inc} icon={<path d="M12 4.5v15m7.5-7.5h-15" />} />
      <Button onClick={dec} icon={<path d="M5 12h14" />} />
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

function useLongPress(callback: () => void, ms = 100) {
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    intervalRef.current ??= setInterval(callback, ms);
  };

  const stop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  React.useEffect(() => stop, [callback, ms]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
  };
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
  step: number,
  format: (val: number) => string,
  callback: (formattedValue: string) => void,
) {
  const value = Number(input.value);
  const newValue = value + direction * step;
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
