import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/pages/shared/lib/utils';
import { Label } from '@/pages/shared/components/ui/Label';

const inputVariants = cva(
  [
    'table w-full rounded-xl overflow-hidden',
    'border border-2 border-transparent focus-within:border-focus',
    'text-medium',
  ],

  {
    variants: {
      variant: {
        default: 'border-base text-medium',
      },
      disabled: {
        true: 'cursor-default border-transparent bg-disabled text-disabled',
      },
      readOnly: {
        true: 'cursor-default border-transparent bg-disabled text-disabled',
      },
      error: {
        true: 'border-error',
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
  ref?: React.RefObject<HTMLInputElement | null>;
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
          inputVariants({ disabled, readOnly, error: !!errorMessage }),
          wrapperClassName,
        )}
      >
        {leadingAddOn ? (
          <InputAddon inputRef={ref}>{leadingAddOn}</InputAddon>
        ) : null}
        <input
          id={id}
          ref={ref}
          type={type}
          className={cn(
            'border-none focus:border-none focus:ring-0 focus:outline-none',
            'table-cell w-full py-3.5 text-base',
            'text-inherit bg-inherit',
            'placeholder:text-disabled',
            leadingAddOn ? 'px-0' : 'px-4',
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
          <InputAddon inputRef={ref}>{trailingAddOn}</InputAddon>
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
  inputRef,
}: React.PropsWithChildren<{
  inputRef?: React.RefObject<HTMLInputElement | null>;
}>) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: only need to handle click on prefix/suffix to trigger input focus
    // biome-ignore lint/a11y/noStaticElementInteractions: only need to handle click on prefix/suffix to trigger input focus
    <div
      className={cn(
        'whitespace-nowrap table-cell align-middle select-none w-[1%]',
        'text-sm font-medium cursor-text px-2',
      )}
      onClick={() => inputRef?.current?.focus()}
    >
      {children}
    </div>
  );
}
