import { type VariantProps, cva } from 'class-variance-authority'
import React, { forwardRef } from 'react'

import { cn } from '@/utils/cn'

const switchVariants = cva(
  [
    'rounded-full bg-disabled-strong relative cursor-pointer transition-colors duration-300 ease-in-out',
    'before:content-[""] before:absolute before:bg-white before:rounded-full',
    'before:top-1/2 before:transform before:-translate-y-1/2 before:left-[4px]',
    'before:transition-all before:duration-300 before:ease-in-out',
    'peer-checked:before:left-[18px] peer-checked:bg-switch-base',
    'peer-focus:outline peer-focus:outline-2 peer-focus:outline-blue-500',
  ],

  {
    variants: {
      size: {
        default: 'w-[42px] h-[26px] before:h-5 before:w-5',
        small: [
          'w-9 h-[22px] before:h-4 before:w-4 before:left-[3px]',
          'peer-checked:before:left-4',
        ],
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface SwitchProps
  extends VariantProps<typeof switchVariants>,
    React.HTMLAttributes<HTMLInputElement> {
  checked?: boolean
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { size, className, ...props },
  ref,
) {
  return (
    <label>
      <input ref={ref} type="checkbox" {...props} className="peer hidden" />
      <div className={cn(switchVariants({ size }), className)} />
    </label>
  )
})
