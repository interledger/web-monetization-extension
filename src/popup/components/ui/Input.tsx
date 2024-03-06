import { type VariantProps, cva } from 'class-variance-authority'
import React, { forwardRef } from 'react'

import { cn } from '@/shared/helpers'
import { Label } from '@/popup/components/ui/Label'

const inputVariants = cva(
  [
    'w-full h-14 rounded-xl border border-2 px-4 text-base text-medium',
    'focus:outline-none focus:border-focus',
    'placeholder-disabled'
  ],

  {
    variants: {
      variant: {
        default: 'border-base'
      },
      disabled: {
        true: 'bg-disabled border-transparent'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface InputProps
  extends VariantProps<typeof inputVariants>,
    React.InputHTMLAttributes<HTMLInputElement> {
  errorMessage?: string
  disabled?: boolean
  addOn?: React.ReactNode
  label?: React.ReactNode
  description?: React.ReactNode
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
  ref
) {
  const id = React.useId()
  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      {description ? <p className="text-xs px-2">{description}</p> : null}
      <div className="relative">
        {addOn ? (
          <div className="pointer-events-none w-10 absolute font-medium inset-y-0 left-0 flex items-center justify-center text-sm">
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
            className
          )}
          disabled={disabled ?? false}
          aria-disabled={disabled ?? false}
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage}
          {...props}
        />
      </div>
      {errorMessage && (
        <p className="text-error text-sm px-2">{errorMessage}</p>
      )}
    </div>
  )
})
