import React from 'react';
import { BudgetScreen } from '@/popup/components/Settings/Budget';
import { usePopupState } from '@/popup/lib/store';

export default () => {
  const { balance, grants, walletAddress } = usePopupState();
  return (
    <BudgetScreen
      walletAddress={walletAddress}
      balance={balance}
      grants={grants}
    />
  );
};
