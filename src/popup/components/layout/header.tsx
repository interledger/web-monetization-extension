import React, { useContext, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import browser from 'webextension-polyfill'
import { ArrowBack, Settings } from '../icons'
import { Switch } from '../ui/Switch'
import { ROUTES_PATH } from '@/popup/Popup'
import { PopupStateContext, ReducerActionType } from '@/popup/lib/context'
import { toggleWM } from '@/popup/lib/messages'

const Logo = browser.runtime.getURL('assets/images/logo.svg')

const NavigationButton = () => {
  const location = useLocation()
  const {
    state: { connected }
  } = useContext(PopupStateContext)
  return useMemo(() => {
    if (!connected) return null

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
  const { state, dispatch } = useContext(PopupStateContext)
  const onChange = async () => {
    await toggleWM()
    dispatch({ type: ReducerActionType.TOGGLE_WM, data: {} })
  }
  return (
    <header className="flex flex-row items-center justify-between h-8">
      <div className="flex flex-row items-center gap-3">
        <img src={Logo} alt="Web Monetization Logo" className="h-6" />
        <p className="text-strong text-xl">Web Monetization</p>
      </div>
      <div className="flex flex-row items-center gap-3">
        <NavigationButton />
        <Switch checked={state.enabled} onChange={onChange} />
      </div>
    </header>
  )
}
