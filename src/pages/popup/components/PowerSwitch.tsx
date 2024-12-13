import React from 'react';
import { Power } from '@/pages/shared/components/Icons';
import { cn } from '@/shared/helpers';

export const PowerSwitch = ({
  enabled,
  onChange,
  title,
  className,
  iconClassName = 'size-6',
}: {
  enabled: boolean;
  onChange: () => void;
  title: string;
  className?: string;
  iconClassName?: string;
}) => {
  return (
    <label
      className={cn(
        'group my-0 cursor-pointer rounded-full p-0.5 transition-colors focus-within:shadow',
        className,
        enabled
          ? 'text-gray-500 focus-within:text-error hover:text-error'
          : 'text-gray-300 focus-within:text-secondary-dark hover:text-secondary-dark',
      )}
      title={title}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={onChange}
        aria-label={title}
        className="sr-only"
      />
      <Power className={iconClassName} />
    </label>
  );
};
