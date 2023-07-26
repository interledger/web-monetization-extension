import '@pages/popup/Popup.css'

import close from '@assets/img/close.svg'
import logo from '@assets/img/logo.svg'
import { queryActiveTab, sendMessage } from '@lib/messageUtils'
import React, { useEffect, useState } from 'react'

const Popup = () => {
  const [monetization, setMonetization] = useState(false)
  useEffect(() => {
    queryActiveTab(
      tab =>
        tab &&
        sendMessage({ action: 'GET_MONETIZATION' }, tab.id, response => {
          setMonetization(response)
        }),
    )
  }, [])

  return (
    <div className="w-[308px] h-[246px]">
      <div className="flex items-center justify-between h-10 px-4">
        <img src={logo} alt="Web Monetization Logo" className="h-6" />
        <div className="">Web Monetization</div>
        <img
          src={close}
          alt="Close"
          className="h-8 cursor-pointer translate-x-1"
          onClick={() => window.close()}
        />
      </div>
      <div>
        {monetization ? (
          <div className="text-center text-green-500">The webpage is monetization-ready.</div>
        ) : (
          <div className="text-center text-orange-500">The webpage is not monetization-ready.</div>
        )}
      </div>
    </div>
  )
}

export default Popup
