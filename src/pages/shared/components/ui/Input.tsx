import { type VariantProps, cva } from 'class-variance-authority';
import React, { forwardRef } from 'react';
import { cn } from '@/pages/shared/lib/utils';
import { Label } from '@/pages/shared/components/ui/Label';

const inputVariants = cva(
  [
    'h-14 w-full rounded-xl border border-2 px-4 text-base text-medium',
    'focus:border-focus focus:outline-none',
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
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
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
    ...props
  },
  ref,
) {
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
      <div className={cn('relative', wrapperClassName)}>
        {leadingAddOn ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-sm font-medium">
            {leadingAddOn}
          </div>
        ) : null}
        <input
          id={id}
          ref={ref}
          type={type}
          className={cn(
            inputVariants({ disabled, readOnly }),
            leadingAddOn && 'pl-10',
            trailingAddOn && 'pr-10',
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
          <div className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-sm font-medium">
            {trailingAddOn}
          </div>
        ) : null}
      </div>
      {errorMessage && (
        <p className="px-2 text-sm text-error">{errorMessage}</p>
      )}
    </div>
  );
});
