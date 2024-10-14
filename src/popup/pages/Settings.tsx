import React from 'react';
import { WalletInformation } from '@/popup/components/WalletInformation';
import { usePopupState } from '@/popup/lib/context';

export const Component = () => {
  const { state } = usePopupState();

  return <WalletInformation info={state} />;
};
