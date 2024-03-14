import { PopupStateContext } from '@/popup/lib/context'
import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

export const ProtectedRoute = () => {
  const { state } = React.useContext(PopupStateContext)

  if (state.connected === false) {
    return <Navigate to="/settings" />
  }

  return <Outlet />
}
