import React, { useEffect, useState } from 'react'
import { runtime } from 'webextension-polyfill'

import RangeSlider from '@/components/range-slider'
import { formatCurrency } from '@/utils/formatCurrency'
import { sendMessage, sendMessageToActiveTab } from '@/utils/sendMessages'
import { getStorageKey } from '@/utils/storage'

const Success = runtime.getURL('assets/images/web-monetization-success.svg')
const Fail = runtime.getURL('assets/images/web-monetization-fail.svg')
const CheckIcon = runtime.getURL('assets/images/check.svg')
const DollarIcon = runtime.getURL('assets/images/dollar.svg')
const CloseIcon = runtime.getURL('assets/images/close.svg')

// --- Temporary code until real UI implemented ---

interface IProps {
  isMonetizationReady: boolean
}

const PopupFooter: React.FC<IProps> = ({ isMonetizationReady }) => (
  <footer className="flex items-center justify-center px-4">
    {isMonetizationReady ? (
      <span>This site is Web Monetization ready</span>
    ) : (
      <span>This site isn&apos;t Web Monetization ready</span>
    )}
  </footer>
)

// --- End of Temporary code until real UI implemented ---

export const Home = () => {
  const [remainingBalance, setRemainingBalance] = useState(0)
  const [rateOfPay, setRateOfPay] = useState(0.36)
  const [loading, setLoading] = useState(false)
  const [paymentStarted, setPaymentStarted] = useState(false)
  const [spent, setSpent] = useState(0)
  const [sendingPaymentPointer, setSendingPaymentPointer] = useState('')
  const [isMonetizationReady, setIsMonetizationReady] = useState(false)
  const [receivingPaymentPointer, setReceivingPaymentPointer] = useState('')
  const [formData, setFormData] = useState({
    paymentPointer: sendingPaymentPointer || '',
    amount: 20,
  })

  useEffect(() => {
    checkMonetizationReady()
    getSendingPaymentPointer()
    listenForIncomingPayment()
    getRateOfPay()
    getRemainingBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getRateOfPay = async () => {
    const response = await getStorageKey('rateOfPay')
    response && setRateOfPay(response)
  }

  const getRemainingBalance = async () => {
    const response = await getStorageKey('amount')
    response && setRemainingBalance(response)
  }

  const checkMonetizationReady = async () => {
    const response = await sendMessageToActiveTab({ type: 'IS_MONETIZATION_READY' })
    setIsMonetizationReady(response.data.monetization)
    setReceivingPaymentPointer(response.data.paymentPointer)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prevState => ({ ...prevState, [event.target.name]: event.target.value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setLoading(true)
    const data = {
      amount: formData.amount,
      paymentPointer: formData.paymentPointer,
      incomingPayment: receivingPaymentPointer,
    }

    await sendMessage({ type: 'SET_INCOMING_POINTER', data })
  }

  const getSendingPaymentPointer = async () => {
    const response = await sendMessage({ type: 'GET_SENDING_PAYMENT_POINTER' })
    setSendingPaymentPointer(response.data.sendingPaymentPointerUrl)

    const { sendingPaymentPointerUrl: paymentPointer, amount } = response.data
    if (paymentPointer && amount) {
      setFormData({
        paymentPointer: response.data.sendingPaymentPointerUrl,
        amount: response.data.amount,
      })
    }
  }

  const listenForIncomingPayment = async () => {
    const listener = (message: any) => {
      if (message.type === 'SPENT_AMOUNT') {
        setSpent(message.data.spentAmount)
        setPaymentStarted(true)
      }

      if (loading) {
        setLoading(false)
      }
    }

    runtime.onMessage.addListener(listener)
    return () => {
      runtime.onMessage.removeListener(listener)
    }
  }

  const stopPayments = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault()
    setPaymentStarted(false)
    setTimeout(() => {
      if (loading) {
        setLoading(false)
      }
    }, 1000)
    await sendMessageToActiveTab({ type: 'STOP_PAYMENTS' })
  }

  const updateRateOfPay = async (value: number) => {
    setRateOfPay(value)
    await sendMessage({ type: 'SET_STORAGE_KEY', data: { key: 'rateOfPay', value } })
  }

  return (
    <>
      {!!spent && (
        <div className="spentAmount">
          ${spent}/<span>$20</span>
        </div>
      )}
      <div className="content">
        <RangeSlider
          title="Current rate of pay"
          min={0.0}
          max={1.2}
          step={0.01}
          value={rateOfPay || 0}
          onChange={updateRateOfPay}
        />
        <div className="flex items-center justify-between w-full pt-4">
          <span>{formatCurrency(rateOfPay)} per hour</span>
          <span>Remaining balance: ${remainingBalance}</span>
        </div>
        {isMonetizationReady ? (
          <>
            <img src={Success} alt="Success" />

            <form
              onSubmit={handleSubmit}
              className={`pointerForm ${paymentStarted ? 'active' : ''}`}>
              <div className="input-wrapper">
                <label htmlFor="paymentPointer">Payment pointer</label>
                <div className="input">
                  <input
                    type="text"
                    name="paymentPointer"
                    value={formData.paymentPointer}
                    onInput={handleChange}
                    disabled={paymentStarted}
                    placeholder="https://ilp.rafiki.money/alice"
                  />
                </div>
              </div>

              <div className="input-wrapper">
                <label htmlFor="pointer">Amount</label>
                <div className="input">
                  <img src={DollarIcon} alt="dollar" />
                  <input
                    type="text"
                    name="amount"
                    value={formData.amount}
                    onInput={handleChange}
                    disabled={paymentStarted}
                    placeholder="0.05"
                  />
                </div>
              </div>

              <div className="actions">
                {paymentStarted ? (
                  <button type="button" className="stop-btn" onClick={stopPayments}>
                    <img src={CloseIcon} alt="Stop" />
                  </button>
                ) : (
                  <button type="submit" className={`submit-btn ${loading ? 'loading' : ''}`}>
                    <img src={CheckIcon} alt="Check" />
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <img src={Fail} alt="Fail" />
        )}
      </div>
      <PopupFooter isMonetizationReady={isMonetizationReady} />
    </>
  )
}
