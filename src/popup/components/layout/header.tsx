import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import browser from 'webextension-polyfill'
import { ArrowBack, Settings } from '../Icons'
import { Switch } from '../ui/Switch'
import { ROUTES_PATH } from '@/popup/Popup'

const Logo = browser.runtime.getURL('assets/images/logo.svg')

const NavigationButton = () => {
  const location = useLocation()

  const component = useMemo(
    () =>
      location.pathname === `/${ROUTES_PATH.SETTINGS}` ? (
        <Link to={ROUTES_PATH.HOME}>
          <ArrowBack className="h-6" />
        </Link>
      ) : (
        <Link to={ROUTES_PATH.SETTINGS}>
          <Settings className="h-6" />
        </Link>
      ),

    [location],
  )

  return component
}

export const Header = () => {
  return (
    <header className="flex flex-row items-center justify-between h-8">
      <div className="flex flex-row items-center gap-3">
        <img src={Logo} alt="Web Monetization Logo" className="h-6" />
        <p className="text-strong text-xl">Web Monetization</p>
      </div>
      <div className="flex flex-row items-center gap-3">
        <NavigationButton />
        <Switch checked={true} />
      </div>
    </header>
  )
}
