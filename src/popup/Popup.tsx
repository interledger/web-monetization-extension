import './Popup.scss'

import React, { useEffect, useState } from 'react'
import { runtime } from 'webextension-polyfill'

import PopupFooter from '@/components/Popup/PopupFooter'
import PopupHeader from '@/components/Popup/PopupHeader'
import { sendMessageToActiveTab } from '@/utils/sendMessages'

const Success = runtime.getURL('assets/images/web-monetization-success.svg')
const Fail = runtime.getURL('assets/images/web-monetization-fail.svg')

const Popup = () => {
  const [isMonetizationReady, setIsMonetizationReady] = useState(false)

  useEffect(() => {
    checkMonetizationReady()
  }, [])

  const checkMonetizationReady = async () => {
    const response = await sendMessageToActiveTab({ type: 'IS_MONETIZATION_READY' })
    setIsMonetizationReady(response.data.monetization)
  }

  return (
    <div className="wrapper">
      <PopupHeader />
      <div className="content">
        {isMonetizationReady ? (
          <img src={Success} alt="Success" className="h-24" />
        ) : (
          <img src={Fail} alt="Fail" className="h-24" />
        )}
      </div>
      <PopupFooter isMonetizationReady={isMonetizationReady} />
    </div>
  )
}

export default Popup
