import React from 'react';
import { useParams } from 'wouter';
import { AddFunds } from '@/popup/components/OutOfFunds';
import { useMessage } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';
import type { ROUTES_PATH } from '@/popup/Popup';

export type State = { recurring: boolean };

export default () => {
  const message = useMessage();
  const { grants, walletAddress } = usePopupState();
  const params = useParams<typeof ROUTES_PATH.OUT_OF_FUNDS_ADD_FUNDS>();

  const state: State = { recurring: params.recurring === 'true' };
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
