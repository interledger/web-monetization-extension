import React from 'react';
import { Power } from '@/pages/shared/components/Icons';
import { cn } from '@/pages/shared/lib/utils';
import { useMessage } from '@/popup/lib/context';
import { dispatch, usePopupState } from '@/popup/lib/store';

export const TogglePaymentsButton = () => {
  const { enabled } = usePopupState();
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
        onClick={(ev) => ev.currentTarget.blur()}
        aria-label={title}
        className="sr-only"
      />
      <Power className={'w-6'} />
    </label>
  );
};
