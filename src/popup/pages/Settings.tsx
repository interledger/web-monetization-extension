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
    return (
      <ConnectWalletForm
        publicKey={state.publicKey}
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
        connectWallet={async (data) => {
          if (!data.skipAutoKeyShare) {
            const res = await message.send('ADD_PUBLIC_KEY_TO_WALLET', {
              walletAddressInfo: data.walletAddressInfo,
            });
            if (!res.success) {
              return {
                ...res,
                message: 'ADD_PUBLIC_KEY_TO_WALLET:' + res.message,
              };
            }
          }
          return await message.send('CONNECT_WALLET', data);
        }}
        onConnect={() => {
          // The popup closes due to redirects on connect, so we don't need to
          // update any state manually.
        }}
      />
    );
  }
};
