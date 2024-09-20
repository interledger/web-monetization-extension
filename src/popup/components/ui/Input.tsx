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
      readOnly: {
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
  readOnly?: boolean;
  addOn?: React.ReactNode;
  addOnPosition?: 'left' | 'right';
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    type = 'text',
    addOn,
    addOnPosition = 'left',
    label,
    description,
    errorMessage,
    disabled,
    className,
    id: providedId,
    ...props
  },
  ref,
) {
  let id = React.useId();
  if (providedId) id = providedId;

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {description ? <p className="px-2 text-xs">{description}</p> : null}
      <div className="relative">
        {addOn ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-y-0 flex w-10 items-center justify-center text-sm font-medium',
              addOnPosition === 'left' ? 'left-0' : 'right-0',
            )}
          >
            {addOn}
          </div>
        ) : null}
        <input
          id={id}
          ref={ref}
          type={type}
          className={cn(
            inputVariants({ disabled }),
            addOn && (addOnPosition === 'left' ? 'pl-10' : 'pr-10'),
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
