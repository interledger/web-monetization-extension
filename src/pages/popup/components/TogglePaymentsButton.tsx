import React from 'react';
import { PowerSwitch } from '@/popup/components/PowerSwitch';
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

  return (
    <PowerSwitch
      enabled={enabled}
      onChange={() => {
        message.send('TOGGLE_PAYMENTS');
        dispatch({ type: 'TOGGLE_PAYMENTS' });
      }}
      title={enabled ? 'Disable extension' : 'Enable extension'}
      iconClassName={large ? 'w-32' : 'w-6'}
    />
  );
};
