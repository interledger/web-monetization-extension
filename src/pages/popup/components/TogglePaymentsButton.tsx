import React from 'react';
import { Power } from '@/pages/shared/components/Icons';
import { cn } from '@/shared/helpers';
import { useMessage } from '@/popup/lib/context';
import { dispatch } from '@/popup/lib/store';

export const TogglePaymentsButton = ({
  large = false,
  enabled = false,
}: {
  large?: boolean;
  enabled?: boolean;
}) => {
  const message = useMessage();
  const title = enabled ? 'Disable extension' : 'Enable extension';

  return (
    <label
      className={cn(
        'group my-0 cursor-pointer rounded-full p-0.5 transition-colors focus-within:shadow',
        enabled
          ? 'text-gray-500 focus-within:text-error hover:text-error'
          : 'text-gray-300 focus-within:text-secondary-dark hover:text-secondary-dark',
      )}
      title={title}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={() => {
          message.send('TOGGLE_PAYMENTS');
          dispatch({ type: 'TOGGLE_PAYMENTS' });
        }}
        aria-label={title}
        className="sr-only"
      />
      <Power className={large ? 'w-32' : 'w-6'} />
    </label>
  );
};
