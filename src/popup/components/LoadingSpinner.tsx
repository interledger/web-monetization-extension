import { type VariantProps, cva } from 'class-variance-authority';
import React from 'react';

import { Spinner } from '@/popup/components/Icons';

const loadingSpinnerStyles = cva('animate-spin', {
  variants: {
    size: {
      md: 'h-4 w-4',
      lg: 'h-6 w-6',
    },
    color: {
      white: 'text-white',
      gray: 'text-gray-300',
    },
  },
  defaultVariants: {
    size: 'lg',
    color: 'white',
  },
});

export type LoadingIndicatorProps = VariantProps<typeof loadingSpinnerStyles>;

export const LoadingSpinner = ({ size, color }: LoadingIndicatorProps) => {
  return <Spinner className={loadingSpinnerStyles({ size, color })} />;
};
