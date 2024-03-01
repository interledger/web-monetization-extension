import { type VariantProps, cva } from 'class-variance-authority'
import React, { forwardRef } from 'react'

import { cn } from '@/utils/helpers'

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
  errorMessage?: string
  disabled?: boolean
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { type = 'text', icon, errorMessage, disabled, className, ...props },
  ref,
) {
  return (
    <div className="relative">
      {icon && <div className="absolute left-4 top-4">{icon}</div>}
      <input
        ref={ref}
        type={type}
        className={cn(inputVariants({ disabled }), icon && 'pl-12', className)}
        disabled={disabled ?? false}
        aria-disabled={disabled ?? false}
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage}
        {...props}
      />
      {errorMessage && <p className="text-error text-sm px-2">{errorMessage}</p>}
    </div>
  )
})
