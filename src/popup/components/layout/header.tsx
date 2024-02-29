import React, { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { runtime } from 'webextension-polyfill'

import { usePopup } from '@/popup/providers/popup.state'

import { ArrowBack, Settings } from '../icons'
import { ROUTES } from '../router-provider'
import { Switch } from '../switch'

const Logo = runtime.getURL('assets/images/logo.svg')

const NavigationButton = () => {
  const location = useLocation()

  const component = useMemo(
    () =>
      location.pathname === `/${ROUTES.SETTINGS}` ? (
        <Link to={ROUTES.INDEX}>
          <ArrowBack className="h-6" />
        </Link>
      ) : (
        <Link to={ROUTES.SETTINGS}>
          <Settings className="h-6" />
        </Link>
      ),

    [location],
  )

  return component
}

export const Header = () => {
  const {
    data: { enabled },
    setData,
  } = usePopup()

  const switchWmEnabled = () => {
    setData(prevState => ({ ...prevState, enabled: !prevState.enabled }))
  }

  return (
    <div className="flex flex-row items-center justify-between h-8">
      <div className="flex flex-row items-center gap-3">
        <img src={Logo} alt="Web Monetization Logo" className="h-6" />
        <p className="text-strong text-xl">Web Monetization</p>
      </div>
      <div className="flex flex-row items-center gap-3">
        <NavigationButton />
        <Switch checked={enabled} onChange={switchWmEnabled} />
      </div>
    </div>
  )
}
