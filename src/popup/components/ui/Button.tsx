import { type VariantProps, cva } from 'class-variance-authority'
import React, { forwardRef } from 'react'

import { LoadingSpinner } from '@/popup/components/LoadingSpinner'
import { cn } from '@/shared/helpers'

const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center whitespace-nowrap rounded-xl font-semibold',
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
        default: 'py-4 px-6 font-medium',
        icon: 'h-6 w-6',
      },
      fullWidth: {
        true: 'w-full',
      },
      loading: {
        true: 'text-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends VariantProps<typeof buttonVariants>,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  ['aria-label']: string
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, loading, className, type = 'button', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, fullWidth, loading }), className)}
      disabled={props.disabled ?? loading ?? false}
      aria-disabled={props.disabled ?? loading ?? false}
      {...props}>
      {loading ? <LoadingSpinner /> : children}
    </button>
  )
})
