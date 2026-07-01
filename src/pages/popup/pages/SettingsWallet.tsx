import React from 'react';
import { WalletInformation } from '@/popup/components/Settings/WalletInformation';
import { usePopupState } from '@/popup/lib/store';

export default () => {
  const { publicKey, walletAddress } = usePopupState();
  return (
    <WalletInformation publicKey={publicKey} walletAddress={walletAddress} />
  );
};
