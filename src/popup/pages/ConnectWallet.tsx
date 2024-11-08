import React from 'react';
import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm';
import { useMessage, usePopupState } from '@/popup/lib/context';
import { getWalletInformation } from '@/shared/helpers';

export const Component = () => {
  const { state } = usePopupState();
  const message = useMessage();

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
        autoKeyAddConsent:
          localStorage?.getItem('connect.autoKeyAddConsent') === 'true',
      }}
      saveValue={(key, val) => {
        localStorage?.setItem(`connect.${key}`, val.toString());
      }}
      getWalletInfo={getWalletInformation}
      connectWallet={(data) => message.send('CONNECT_WALLET', data)}
      onConnect={() => {
        // The popup closes due to redirects on connect, so we don't need to
        // update any state manually.
        // But we reload it, as it's open all-time when running E2E tests
        window.location.reload();
      }}
      clearConnectState={() => message.send('CONNECT_WALLET', null)}
    />
  );
};
