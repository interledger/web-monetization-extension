import { type VariantProps, cva } from 'class-variance-authority'
import React from 'react'

import { Spinner } from '@/popup/components/icons'

const loadingSpinnerStyles = cva('animate-spin text-white', {
  variants: {
    variant: {
      md: 'h-4 w-4',
      lg: 'h-6 w-6',
    },
  },
  defaultVariants: {
    variant: 'lg',
  },
})

export type LoadingIndicatorProps = VariantProps<typeof loadingSpinnerStyles>

export const LoadingSpinner = ({ variant }: LoadingIndicatorProps) => {
  return <Spinner className={loadingSpinnerStyles({ variant })} />
}
