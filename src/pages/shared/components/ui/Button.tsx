import React from 'react';
import { forwardRef } from 'react';
import { type VariantProps, cva } from 'class-variance-authority';

import { LoadingSpinner } from '@/pages/shared/components/LoadingSpinner';
import { cn } from '@/pages/shared/lib/utils';

const buttonVariants = cva(
  [
    'relative inline-flex gap-2 items-center justify-center whitespace-nowrap rounded-xl font-semibold',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
    'disabled:pointer-events-none disabled:select-none disabled:opacity-50',
  ],

  {
    variants: {
      variant: {
        default: 'bg-button-base text-white hover:bg-button-base-hover',
        destructive: 'bg-error text-error hover:bg-error-hover',
        ghost: '',
      },
      size: {
        default: 'px-6 py-4 font-medium',
        icon: 'h-6 w-6',
      },
      fullWidth: {
        true: 'w-full',
      },
      loading: {
        true: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends VariantProps<typeof buttonVariants>,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  /** Optional only when children are passed */
  'aria-label'?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant,
      size,
      fullWidth,
      loading = false,
      loadingText,
      className,
      type = 'button',
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          buttonVariants({ variant, size, fullWidth, loading }),
          className,
        )}
        data-progress={loading.toString()}
        disabled={props.disabled ?? loading ?? false}
        aria-disabled={props.disabled ?? loading ?? false}
        {...props}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            {loadingText}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);
