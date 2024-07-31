import React, { useContext, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowBack, Settings } from '../Icons'
import { ROUTES_PATH } from '@/popup/Popup'
import { PopupStateContext, useBrowser } from '@/popup/lib/context'

const NavigationButton = () => {
  const location = useLocation()
  const {
    state: { connected }
  } = useContext(PopupStateContext)
  return useMemo(() => {
    if (!connected) return null

    if (location.pathname.includes('/s/')) {
      return (
        <Link to={location.pathname.split('/s/')[0]}>
          <ArrowBack className="h-6" />
        </Link>
      )
    }

    return location.pathname === `${ROUTES_PATH.SETTINGS}` ? (
      <Link to={ROUTES_PATH.HOME}>
        <ArrowBack className="h-6" />
      </Link>
    ) : (
      <Link to={ROUTES_PATH.SETTINGS}>
        <Settings className="h-6" />
      </Link>
    )
  }, [location, connected])
}

export const Header = () => {
  const browser = useBrowser()
  const Logo = browser.runtime.getURL('assets/images/logo.svg')

  return (
    <header className="flex h-8 flex-row items-center justify-between">
      <div className="flex flex-row items-center gap-3">
        <img src={Logo} alt="Web Monetization Logo" className="h-6" />
        <p className="text-xl text-strong">Web Monetization</p>
      </div>
      <div className="flex flex-row items-center gap-3">
        <NavigationButton />
      </div>
    </header>
  )
}
