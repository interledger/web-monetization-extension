import './Popup.scss'

import React, { useEffect, useState } from 'react'
import { runtime } from 'webextension-polyfill'

import PopupFooter from '@/components/Popup/PopupFooter'
import PopupHeader from '@/components/Popup/PopupHeader'
import { sendMessage, sendMessageToActiveTab } from '@/utils/sendMessages'

const Success = runtime.getURL('assets/images/web-monetization-success.svg')
const Fail = runtime.getURL('assets/images/web-monetization-fail.svg')

const Popup = () => {
  const [paymentPointer, setPaymentPointer] = useState('')
  const [isMonetizationReady, setIsMonetizationReady] = useState(false)

  useEffect(() => {
    checkMonetizationReady()
  }, [])

  const checkMonetizationReady = async () => {
    const response = await sendMessageToActiveTab({ type: 'IS_MONETIZATION_READY' })
    setIsMonetizationReady(response.data.monetization)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPaymentPointer(event.target.value)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendMessage({ type: 'SET_INCOMING_POINTER', data: { paymentPointer } })
    window.close()
  }

  return (
    <div className="wrapper">
      <PopupHeader />
      <div className="content">
        {isMonetizationReady ? (
          <>
            <img src={Success} alt="Success" />

            <form onSubmit={handleSubmit} className="pointerForm">
              <div>
                <label htmlFor="pointer">Payment pointer</label>
                <input
                  type="text"
                  name="pointer"
                  value={paymentPointer}
                  onInput={handleChange}
                  placeholder="https://ilp.rafiki.money/pointer"
                  className="w-full h-8 px-2 border border-gray-300 focus:outline-0"
                />
              </div>
              <button type="submit">Submit</button>
            </form>
          </>
        ) : (
          <img src={Fail} alt="Fail" />
        )}
      </div>
      <PopupFooter isMonetizationReady={isMonetizationReady} />
    </div>
  )
}

export default Popup
