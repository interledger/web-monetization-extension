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
        'my-0 cursor-pointer rounded-full p-0.5 text-slate-300 transition-colors focus-within:text-slate-600 focus-within:outline hover:text-slate-600',
        className,
        enabled && 'text-slate-500',
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
