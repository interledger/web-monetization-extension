import { cn } from '@/shared/helpers';
import React from 'react';

export const PowerSwitch = ({
  enabled,
  onChange,
  title,
}: {
  enabled: boolean;
  onChange: () => void;
  title: string;
}) => {
  return (
    <label
      className={cn(
        'my-0 cursor-pointer rounded-full p-0.5 outline-gray-200 focus-within:outline',
        enabled
          ? 'text-green-500 focus-within:text-green-600 hover:text-green-600'
          : 'text-red-500 focus-within:text-red-600 hover:text-red-600',
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
      <svg
        className="size-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={3}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
      </svg>
    </label>
  );
};
