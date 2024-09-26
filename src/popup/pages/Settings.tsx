import React from 'react';
import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm';
import { WalletInformation } from '@/popup/components/WalletInformation';
import { useMessage, usePopupState } from '@/popup/lib/context';
import { getWalletInformation } from '@/shared/helpers';

export const Component = () => {
  const { state } = usePopupState();
  const message = useMessage();

  if (state.connected) {
    return <WalletInformation info={state} />;
  } else {
    const connectState = state.transientState['connect'];
    return (
      <ConnectWalletForm
        publicKey={state.publicKey}
        state={connectState}
        defaultValues={{
          recurring:
            localStorage?.getItem('connect.recurring') === 'true' || false,
          amount: localStorage?.getItem('connect.amount') || undefined,
          walletAddressUrl:
            localStorage?.getItem('connect.walletAddressUrl') || undefined,
        }}
        saveValue={(key, val) => {
          localStorage?.setItem(`connect.${key}`, val.toString());
        }}
        getWalletInfo={getWalletInformation}
        connectWallet={(data) => message.send('CONNECT_WALLET', data)}
        onConnect={() => {
          // The popup closes due to redirects on connect, so we don't need to
          // update any state manually.
        }}
      />
    );
  }
};
