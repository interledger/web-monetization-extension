import React from 'react';
import { useLocation } from 'wouter';
import {
  ConnectStateContext,
  ConnectWalletForm,
  getSavedValues,
  saveValue,
  useConnectWalletFormActions,
} from '@/popup/components/ConnectWalletForm';
import { useMessage } from '@/popup/lib/context';
import { usePopupState } from '@/popup/lib/store';
import { ROUTES_PATH } from '@/popup/Popup';

export default () => {
  const message = useMessage();
  const [_location, navigate] = useLocation();
  const {
    transientState: { connect: connectState },
    publicKey,
  } = usePopupState();

  const initialConnectState = React.useRef(connectState).current;
  const defaultValues = React.useMemo(getSavedValues, []);
  const { getWalletInfo, connectWallet, clearConnectState } =
    useConnectWalletFormActions(message);

  const onConnect = React.useCallback(() => {
    // The popup closes due to redirects on connect, so we don't need to
    // update any state manually.
    // But we reload it, as it's open all-time when running E2E tests
    navigate(ROUTES_PATH.HOME);
    window.location.reload();
  }, [navigate]);

  return (
    // @ts-expect-error we know, it's complicated
    <ConnectStateContext.Provider value={connectState}>
      <ConnectWalletForm
        publicKey={publicKey}
        // @ts-expect-error we know, it's complicated
        initialState={initialConnectState}
        defaultValues={defaultValues}
        saveValue={saveValue}
        getWalletInfo={getWalletInfo}
        connectWallet={connectWallet}
        onConnect={onConnect}
        clearConnectState={clearConnectState}
      />
    </ConnectStateContext.Provider>
  );
};
