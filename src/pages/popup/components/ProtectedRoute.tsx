import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { usePopupState } from '@/popup/lib/store';
import { ROUTES_PATH } from '../Popup';

export const ProtectedRoute = () => {
  const { state, connected } = usePopupState();

  if (state.missing_host_permissions) {
    return <Navigate to={ROUTES_PATH.MISSING_HOST_PERMISSION} />;
  }
  if (state.key_revoked) {
    return <Navigate to={ROUTES_PATH.ERROR_KEY_REVOKED} />;
  }
  if (state.out_of_funds) {
    return <Navigate to={ROUTES_PATH.OUT_OF_FUNDS} />;
  }
  if (connected === false) {
    return <Navigate to={ROUTES_PATH.CONNECT_WALLET} />;
  }

  return <Outlet />;
};
