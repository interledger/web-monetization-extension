import { type VariantProps, cva } from 'class-variance-authority'
import React, { forwardRef } from 'react'

import { cn } from '@shared/helpers'

const labelVariants = cva(
  'flex items-center px-2 font-medium leading-6 text-medium'
)

export interface LabelProps
  extends VariantProps<typeof labelVariants>,
    React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, children, ...props },
  ref
) {
  return (
    <label ref={ref} className={cn(labelVariants(), className)} {...props}>
      {children}
    </label>
  )
})
