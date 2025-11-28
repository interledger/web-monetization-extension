import { type VariantProps, cva } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/pages/shared/lib/utils';

const switchVariants = cva(
  [
    'relative inline-block cursor-pointer rounded-full bg-disabled-strong transition-colors duration-300 ease-in-out',
    'before:absolute before:rounded-full before:bg-white before:content-[""]',
    'before:left-[4px] before:top-1/2 before:-translate-y-1/2 before:transform',
    'before:transition-all before:duration-300 before:ease-in-out',
    'peer-checked:bg-switch-base peer-checked:before:left-[18px]',
    'peer-focus:outline peer-focus:outline-2 peer-focus:outline-blue-500',
  ],

  {
    variants: {
      size: {
        default: 'h-[26px] w-[42px] before:h-5 before:w-5',
        small: [
          'h-[22px] w-9 before:left-[3px] before:h-4 before:w-4',
          'peer-checked:before:left-4',
        ],
      },
      disabled: {
        true: 'opacity-75',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

export interface SwitchProps
  extends VariantProps<typeof switchVariants>,
    Omit<React.ComponentPropsWithRef<'input'>, 'size'> {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Switch({
  label,
  id,
  checked = false,
  onChange = () => {},
  ref,
  ...props
}: SwitchProps) {
  const randomId = React.useId();
  return (
    <label className="flex items-center gap-x-4" htmlFor={id || randomId}>
      <SwitchButton
        id={id || randomId}
        checked={checked}
        onChange={onChange}
        ref={ref}
        {...props}
      />
      <span className="font-normal">{label}</span>
    </label>
  );
}

interface SwitchButtonProps
  extends VariantProps<typeof switchVariants>,
    Omit<React.ComponentPropsWithRef<'input'>, 'size'> {
  id: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export function SwitchButton({
  id,
  checked,
  onChange,
  disabled,
  size,
  ref,
  ...props
}: SwitchButtonProps) {
  return (
    <span>
      <input
        // biome-ignore lint/a11y/useAriaPropsForRole: todo
        role="switch"
        type="checkbox"
        checked={checked}
        onChange={onChange}
        id={id}
        disabled={disabled ?? false}
        ref={ref}
        {...props}
        className="peer absolute -translate-x-[100%] opacity-0"
      />
      <span className={cn(switchVariants({ size, disabled }))} />
    </span>
  );
}
