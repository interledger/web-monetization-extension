import React from 'react';
import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm';
import { useMessage } from '@/popup/lib/context';
import { getWalletInformation } from '@/shared/helpers';
import { usePopupState } from '@/popup/lib/store';

export const Component = () => {
  const { transientState, publicKey } = usePopupState();
  const message = useMessage();

  React.useEffect(() => {
    if (window.self !== window.top) {
      // if used in iframe (in post install screen), remove header
      document.querySelector('header')?.remove();
      document.querySelector('.bg-divider-gradient')?.remove();
    }
  }, []);

  const connectState = transientState.connect;
  return (
    <ConnectWalletForm
      publicKey={publicKey}
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
