import { type VariantProps, cva } from 'class-variance-authority';
import React, { forwardRef } from 'react';
import { cn } from '@/shared/helpers';
import { Label } from '@/popup/components/ui/Label';

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
        true: 'border-transparent bg-disabled',
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
  addOn?: React.ReactNode;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    type = 'text',
    addOn,
    label,
    description,
    errorMessage,
    disabled,
    className,
    ...props
  },
  ref,
) {
  const id = React.useId();
  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {description ? <p className="px-2 text-xs">{description}</p> : null}
      <div className="relative">
        {addOn ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-sm font-medium">
            {addOn}
          </div>
        ) : null}
        <input
          id={id}
          ref={ref}
          type={type}
          className={cn(
            inputVariants({ disabled }),
            addOn && 'pl-10',
            errorMessage && 'border-error',
            className,
          )}
          disabled={disabled ?? false}
          aria-disabled={disabled ?? false}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage}
          {...props}
        />
      </div>
      {errorMessage && (
        <p className="px-2 text-sm text-error">{errorMessage}</p>
      )}
    </div>
  );
});
