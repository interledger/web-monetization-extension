import './Popup.scss'

import React, { useEffect, useState } from 'react'
import { runtime } from 'webextension-polyfill'

import PopupFooter from '@/components/Popup/PopupFooter'
import PopupHeader from '@/components/Popup/PopupHeader'
import { sendMessage, sendMessageToActiveTab } from '@/utils/sendMessages'

const Success = runtime.getURL('assets/images/web-monetization-success.svg')
const Fail = runtime.getURL('assets/images/web-monetization-fail.svg')
const CheckIcon = runtime.getURL('assets/images/check.svg')
const EditIcon = runtime.getURL('assets/images/edit.svg')
const DollarIcon = runtime.getURL('assets/images/dollar.svg')

const Popup = () => {
  const [sendingPaymentPointer, setSendingPaymentPointer] = useState('')
  const [amount, setAmount] = useState('')
  const [isMonetizationReady, setIsMonetizationReady] = useState(false)
  const [receivingPaymentPointer, setReceivingPaymentPointer] = useState('')
  const [isEditing, setIsEditing] = useState(!!sendingPaymentPointer)
  const [isEditingAmount, setIsEditingAmount] = useState(!!amount)

  useEffect(() => {
    checkMonetizationReady()
    getSendingPaymentPointer()
  }, [])

  const checkMonetizationReady = async () => {
    const response = await sendMessageToActiveTab({ type: 'IS_MONETIZATION_READY' })
    setIsMonetizationReady(response.data.monetization)
    setReceivingPaymentPointer(response.data.pointer)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSendingPaymentPointer(event.target.value)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsEditingAmount(false)
    setIsEditing(false)
    const data = {
      amount: amount,
      assetCode: 'USD',
      assetScale: '2',
      receipt: null,
      amountSent: {
        amount: '1', // 0.01
        currency: 'USD',
      },
      paymentPointer: sendingPaymentPointer,
      incomingPayment: receivingPaymentPointer,
    }

    await sendMessage({ type: 'SET_INCOMING_POINTER', data })
  }

  const getSendingPaymentPointer = async () => {
    const response = await sendMessage({ type: 'GET_SENDING_PAYMENT_POINTER' })
    console.log('response ==== ', response)
    setSendingPaymentPointer(response.data.sendingPaymentPointerUrl)
  }

  const toggleEdit = () => {
    setIsEditing(!isEditing)
  }

  return (
    <div className="wrapper">
      <PopupHeader />
      <div className="content">
        {isMonetizationReady ? (
          <>
            <img src={Success} alt="Success" />

            <form onSubmit={handleSubmit} className="pointerForm">
              <div className="input-wrapper">
                <label htmlFor="pointer">Payment pointer</label>
                <div
                  className={`input ${
                    !!sendingPaymentPointer && !isEditing ? 'input-disabled' : ''
                  }`}>
                  <input
                    type="text"
                    name="pointer"
                    value={sendingPaymentPointer}
                    onInput={handleChange}
                    placeholder="https://ilp.rafiki.money/pointer"
                  />
                  {sendingPaymentPointer && !isEditing && (
                    <button type="button" className="edit-btn" onClick={toggleEdit}>
                      <img src={EditIcon} alt="edit" />
                    </button>
                  )}
                  {(isEditing || !sendingPaymentPointer) && (
                    <button type="submit">
                      <img src={CheckIcon} alt="Check" />
                    </button>
                  )}
                </div>
              </div>

              <div className="input-wrapper">
                <label htmlFor="pointer">Amount</label>
                <div className={`input ${!!amount && !isEditingAmount ? 'input-disabled' : ''}`}>
                  <img src={DollarIcon} alt="dollar" />
                  <input
                    type="text"
                    name="amount"
                    value={amount}
                    onInput={(event: React.ChangeEvent<HTMLInputElement>) =>
                      setAmount(event.target.value)
                    }
                    placeholder="0.05"
                  />
                  {amount && !isEditingAmount && (
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => setIsEditingAmount(true)}>
                      <img src={EditIcon} alt="edit" />
                    </button>
                  )}
                  {(isEditingAmount || !amount) && (
                    <button type="submit">
                      <img src={CheckIcon} alt="Check" />
                    </button>
                  )}
                </div>
              </div>
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
