import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/shared/helpers';

const labelVariants = cva(
  'flex items-center px-2 font-medium leading-6 text-medium',
);

export interface LabelProps
  extends VariantProps<typeof labelVariants>,
    React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  function Label({ className, children, ...props }, ref) {
    return (
      // biome-ignore lint/a11y/noLabelWithoutControl:  We add the relevant props to the label
      <label ref={ref} className={cn(labelVariants(), className)} {...props}>
        {children}
      </label>
    );
  },
);
