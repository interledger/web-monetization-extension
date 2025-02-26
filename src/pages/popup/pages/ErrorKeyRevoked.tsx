import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorKeyRevoked } from '@/popup/components/ErrorKeyRevoked';
import { useMessage } from '@/popup/lib/context';
import { ROUTES_PATH } from '@/popup/Popup';
import { dispatch, usePopupState } from '@/popup/lib/store';

export const Component = () => {
  const message = useMessage();
  const { publicKey, walletAddress } = usePopupState();
  const navigate = useNavigate();

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
