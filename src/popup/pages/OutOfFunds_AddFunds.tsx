import React from 'react';
import { useLocation } from 'react-router-dom';
import { AddFunds } from '@/popup/components/OutOfFunds';
import { usePopupState, useMessage } from '@/popup/lib/context';

export type State = { recurring: boolean };

export const Component = () => {
  const message = useMessage();
  const {
    state: { grants, walletAddress },
  } = usePopupState();
  const location = useLocation();

  const state: State = { recurring: false, ...location.state };
  const defaultAmount = grants.recurring?.value ?? grants.oneTime!.value;

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
