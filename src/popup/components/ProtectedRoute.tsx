import { PopupStateContext } from '@/popup/lib/context'
import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { ROUTES_PATH } from '../Popup'

export const ProtectedRoute = () => {
  const { state } = React.useContext(PopupStateContext)

  if (!state.hasHostPermissions) {
    return <Navigate to={ROUTES_PATH.MISSING_HOST_PERMISSION} />
  }
  if (state.connected === false) {
    return <Navigate to={ROUTES_PATH.SETTINGS} />
  }

  return <Outlet />
}
