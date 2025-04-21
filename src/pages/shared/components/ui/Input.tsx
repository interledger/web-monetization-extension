import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/pages/shared/lib/utils';
import { Label } from '@/pages/shared/components/ui/Label';

const inputVariants = cva(
  [
    'border-none focus:border-none focus:ring-0 focus:outline-none',
    'table-cell w-full py-4 px-2 text-base text-medium',
    'placeholder:text-disabled',
  ],

  {
    variants: {
      variant: {
        default: 'border-base',
      },
      disabled: {
        true: 'cursor-default border-transparent bg-disabled text-disabled',
      },
      readOnly: {
        true: 'cursor-default border-transparent bg-disabled text-disabled',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface InputProps
  extends VariantProps<typeof inputVariants>,
    React.InputHTMLAttributes<HTMLInputElement> {
  errorMessage?: string;
  disabled?: boolean;
  readOnly?: boolean;
  leadingAddOn?: React.ReactNode;
  trailingAddOn?: React.ReactNode;
  label?: React.ReactNode;
  description?: React.ReactNode;
  wrapperClassName?: string;
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({
  type = 'text',
  leadingAddOn,
  trailingAddOn,
  label,
  description,
  errorMessage,
  disabled,
  readOnly,
  className,
  wrapperClassName,
  id,
  ref,
  ...props
}: InputProps) {
  const randomId = React.useId();
  id ||= randomId; // cannot call useId conditionally, but use randomId only if default not provided

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {description ? (
        <p className="px-2 text-xs" data-testid={`input-${id}-description`}>
          {description}
        </p>
      ) : null}
      <div
        className={cn(
          'table px-2 w-full rounded-xl overflow-hidden',
          'border-2 outline-transparent focus-within:border-focus',
          wrapperClassName,
        )}
      >
        {leadingAddOn ? (
          <InputAddon type="leading" inputRef={ref}>
            {leadingAddOn}
          </InputAddon>
        ) : null}
        <input
          id={id}
          ref={ref}
          type={type}
          className={cn(
            inputVariants({ disabled, readOnly }),
            errorMessage && 'border-error',
            className,
          )}
          disabled={disabled}
          readOnly={readOnly}
          aria-disabled={disabled ?? false}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage}
          {...props}
        />
        {trailingAddOn ? (
          <InputAddon type="trailing" inputRef={ref}>
            {trailingAddOn}
          </InputAddon>
        ) : null}
      </div>
      {errorMessage && (
        <p className="px-2 text-sm text-error">{errorMessage}</p>
      )}
    </div>
  );
}

function InputAddon({
  children,
  className = '',
  type,
  inputRef,
}: {
  children: React.ReactNode;
  type: 'leading' | 'trailing';
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: only need to handle click on prefix/suffix to trigger input focus
    <div
      className={cn(
        'whitespace-nowrap table-cell align-middle select-none w-[1%]',
        'text-sm font-medium p-1 cursor-text',
        className,
      )}
      onClick={() => inputRef?.current?.focus()}
    >
      {children}
    </div>
  );
}
