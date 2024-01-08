import { type VariantProps, cva } from 'class-variance-authority'
import React, { forwardRef } from 'react'

import { cn } from '@/utils/cn'

const inputVariants = cva(
  [
    'w-full h-14 rounded-xl border border-2 px-4 text-base text-medium',
    'focus:outline-none focus:border-focus',
    'placeholder-disabled',
  ],

  {
    variants: {
      variant: {
        default: 'border-base',
      },
      loading: {
        true: 'text-transparent',
      },
      disabled: {
        true: 'bg-disabled border-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface InputProps
  extends VariantProps<typeof inputVariants>,
    React.InputHTMLAttributes<HTMLInputElement> {
  loading?: boolean
  error?: string
  disabled?: boolean
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { type = 'text', icon, loading, error, disabled, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      {icon && <div className="absolute left-4 top-4">{icon}</div>}
      <input
        ref={ref}
        type={type}
        className={cn(inputVariants({ loading, hasIcon: !!icon, disabled, error }), className)}
        disabled={disabled ?? loading ?? false}
        aria-disabled={disabled ?? loading ?? false}
        {...props}
      />
    </div>
  )
})
