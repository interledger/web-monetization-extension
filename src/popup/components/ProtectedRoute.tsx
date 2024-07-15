import { PopupStateContext } from '@/popup/lib/context'
import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { ROUTES_PATH } from '../Popup'

export const ProtectedRoute = () => {
  const { state } = React.useContext(PopupStateContext)

  if (state.state.missing_host_permissions) {
    return <Navigate to={ROUTES_PATH.MISSING_HOST_PERMISSION} />
  }
  if (state.state.key_revoked) {
    return <Navigate to={ROUTES_PATH.ERROR_KEY_REVOKED} />
  }
  if (state.connected === false) {
    return <Navigate to={ROUTES_PATH.SETTINGS} />
  }

  return <Outlet />
}
