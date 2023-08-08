import '@/pages/popup/Popup.css'

import React, { useEffect, useState } from 'react'

import close from '@/assets/img/close.svg'
import logo from '@/assets/img/logo.svg'
import failIcon from '@/assets/img/web-monetization-fail.svg'
import successIcon from '@/assets/img/web-monetization-success.svg'
import { queryActiveTab, sendTabsMessage } from '@/lib/messageUtils'

const Popup = () => {
  const [monetization, setMonetization] = useState(false)

  useEffect(() => {
    queryActiveTab(
      tab =>
        tab &&
        sendTabsMessage({ action: 'GET_MONETIZATION' }, tab.id, response => {
          setMonetization(response)
        }),
    )
  }, [])

  const closePopup = () => {
    window.close()
  }

  return (
    <div className="flex flex-col w-[308px] h-[246px]">
      <div className="flex items-center justify-between h-10 px-4 basis-12 shrink-0">
        <img src={logo} alt="Web Monetization Logo" className="h-6" />
        <div className="text-sm font-medium">Web Monetization</div>
        <button className="p-0 border-0" onClick={closePopup}>
          <img src={close} alt="Close" className="h-8" />
        </button>
      </div>
      <div className="flex flex-col items-center justify-center h-48 basis-auto">
        {monetization ? (
          <img src={successIcon} alt="Success" className="h-24" />
        ) : (
          <img src={failIcon} alt="Fail" className="h-24" />
        )}
      </div>
      <div className="flex items-center justify-center px-5 text-sm border-t basis-12 shrink-0 border-slate-200 text-slate-500">
        {monetization ? (
          <span>This site is Web Monetization ready</span>
        ) : (
          <span>This site isn&apos;t Web Monetization ready</span>
        )}
      </div>
    </div>
  )
}

export default Popup
