import browser from 'webextension-polyfill'
import React from 'react'
import { Outlet } from 'react-router-dom'

import { PERMISSION_HOSTS } from '@/shared/constants'

import { Header } from './header'
import { MissingHostPermission } from '@/popup/components/MissingHostPermission'

const Divider = () => {
  return <div className="w-100 h-1 bg-divider-gradient" />
}

export const MainLayout = () => {
  const [hasHostPermission, setHasHostPermission] = React.useState(true)

  React.useEffect(() => {
    const checkPermissions = async () => {
      try {
        const status = await browser.permissions.contains(PERMISSION_HOSTS)
        setHasHostPermission(status)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error)
      }
    }
    void checkPermissions()
    browser.permissions.onAdded.addListener(checkPermissions)
    browser.permissions.onRemoved.addListener(checkPermissions)

    return () => {
      browser.permissions.onAdded.removeListener(checkPermissions)
      browser.permissions.onRemoved.removeListener(checkPermissions)
    }
  }, [])

  return (
    <div className="h-popup w-popup space-y-4 border-base px-6 py-4">
      <Header />
      <Divider />
      <main>{hasHostPermission ? <Outlet /> : <MissingHostPermission />}</main>
    </div>
  )
}
