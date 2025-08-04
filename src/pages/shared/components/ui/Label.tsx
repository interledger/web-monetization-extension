import React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/pages/shared/lib/utils';

const labelVariants = cva(
  'flex items-center px-2 font-medium leading-6 text-medium',
);

export interface LabelProps
  extends VariantProps<typeof labelVariants>,
    React.ComponentPropsWithRef<'label'> {
  children: React.ReactNode;
}

export function Label({ className, children, ref, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl:  We add the relevant props to the label
    <label ref={ref} className={cn(labelVariants(), className)} {...props}>
      {children}
    </label>
  );
}
