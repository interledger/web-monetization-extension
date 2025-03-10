import React from 'react';
import { useLocation } from 'wouter';
import { OutOfFunds } from '@/popup/components/OutOfFunds';
import { usePopupState } from '@/popup/lib/store';
import { ROUTES_PATH } from '@/popup/Popup';
import type { State } from '@/popup/pages/OutOfFunds_AddFunds';

export default () => {
  const { grants, walletAddress } = usePopupState();
  const [_location, navigate] = useLocation();

  return (
    <OutOfFunds
      info={walletAddress}
      grantOneTime={grants.oneTime}
      grantRecurring={grants.recurring}
      onChooseOption={(recurring) => {
        const state: State = { recurring };
        navigate(
          ROUTES_PATH.OUT_OF_FUNDS_ADD_FUNDS.replace(
            ':recurring',
            String(state.recurring),
          ),
        );
      }}
    />
  );
};
