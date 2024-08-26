import React from 'react';
import { ErrorKeyRevoked } from '@/popup/components/ErrorKeyRevoked';
import {
  useMessage,
  usePopupState,
  ReducerActionType,
} from '@/popup/lib/context';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATH } from '@/popup/Popup';

export const Component = () => {
  const message = useMessage();
  const {
    state: { publicKey, walletAddress },
    dispatch,
  } = usePopupState();
  const navigate = useNavigate();

  const onReconnect = () => {
    dispatch({
      type: 'SET_STATE',
      data: { state: {}, prevState: {} },
    });
    navigate(ROUTES_PATH.HOME);
  };

  const onDisconnect = () => {
    dispatch({
      type: ReducerActionType.SET_CONNECTED,
      data: { value: false },
    });
    navigate(ROUTES_PATH.HOME);
  };

  return (
    <ErrorKeyRevoked
      info={{ publicKey, walletAddress }}
      reconnectWallet={() => message.send('RECONNECT_WALLET')}
      onReconnect={onReconnect}
      disconnectWallet={() => message.send('DISCONNECT_WALLET')}
      onDisconnect={onDisconnect}
    />
  );
};
