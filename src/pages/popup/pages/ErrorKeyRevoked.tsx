import React from 'react';
import { useLocation } from 'wouter';
import { ErrorKeyRevoked } from '@/popup/components/ErrorKeyRevoked';
import { useMessage } from '@/popup/lib/context';
import { ROUTES_PATH } from '@/popup/Popup';
import { dispatch, usePopupState } from '@/popup/lib/store';

export default () => {
  const message = useMessage();
  const { publicKey, walletAddress } = usePopupState();
  const [_location, navigate] = useLocation();

  const onReconnect = () => {
    dispatch({
      type: 'SET_STATE',
      data: { state: {}, prevState: {} },
    });
    navigate(ROUTES_PATH.HOME);
    window.location.reload();
  };

  const onDisconnect = () => {
    dispatch({
      type: 'SET_CONNECTED',
      data: { connected: false },
    });
    navigate(ROUTES_PATH.HOME);
  };

  return (
    <ErrorKeyRevoked
      info={{ publicKey, walletAddress }}
      reconnectWallet={(data) => message.send('RECONNECT_WALLET', data)}
      onReconnect={onReconnect}
      disconnectWallet={() => message.send('DISCONNECT_WALLET')}
      onDisconnect={onDisconnect}
    />
  );
};
