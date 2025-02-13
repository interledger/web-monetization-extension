import React from 'react';
import { useLocation } from 'react-router-dom';
import { AddFunds } from '@/popup/components/OutOfFunds';
import { useMessage } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';

export type State = { recurring: boolean };

export const Component = () => {
  const message = useMessage();
  const { grants, walletAddress } = usePopupState();
  const location = useLocation();

  const state: State = { recurring: false, ...location.state };
  let defaultAmount: string;

  if (grants.recurring?.value) {
    defaultAmount = grants.recurring.value;
  } else if (grants.oneTime?.value) {
    defaultAmount = grants.oneTime.value;
  } else {
    throw new Error('Neither grants.recurring nor grants.oneTime is defined');
  }

  return (
    <AddFunds
      info={walletAddress}
      defaultAmount={defaultAmount}
      recurring={state.recurring}
      requestAddFunds={async (data) => {
        const res = await message.send('ADD_FUNDS', data);
        return res;
      }}
    />
  );
};
