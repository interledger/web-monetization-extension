import React from 'react';
import { useLocation } from 'wouter';
import { ConnectWalletForm } from '@/popup/components/ConnectWalletForm';
import { useMessage } from '@/popup/lib/context';
import { getConnectWalletInfo } from '@/shared/helpers';
import { usePopupState } from '@/popup/lib/store';
import { ROUTES_PATH } from '@/popup/Popup';

export default () => {
  const message = useMessage();
  const [_location, navigate] = useLocation();
  const {
    transientState: { connect: connectState },
    publicKey,
  } = usePopupState();

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
      getWalletInfo={getConnectWalletInfo}
      connectWallet={(data) => message.send('CONNECT_WALLET', data)}
      onConnect={() => {
        // The popup closes due to redirects on connect, so we don't need to
        // update any state manually.
        // But we reload it, as it's open all-time when running E2E tests
        navigate(ROUTES_PATH.HOME);
        window.location.reload();
      }}
      clearConnectState={() => message.send('RESET_CONNECT_STATE')}
    />
  );
};
