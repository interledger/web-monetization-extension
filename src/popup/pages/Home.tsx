import React, { useEffect, useState } from 'react'
import { runtime } from 'webextension-polyfill'

import { sendMessage, sendMessageToActiveTab } from '@/utils/sendMessages'
import { Input } from '@/components/input'
import { Label } from '@/components/label'
import { DollarSign } from '@/components/icons'
import { Button } from '@/components/button'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <>
      {!!spent && (
        <div className="spentAmount">
          ${spent}/<span>$20</span>
        </div>
      )}
      <div className="mb-20">
        {isMonetizationReady ? (
          <>
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <Label className="text-base" htmlFor="paymentPointer">
                  Wallet address
                </Label>
                <Input
                  id="paymentPointer"
                  name="paymentPointer"
                  onInput={handleChange}
                  disabled={paymentStarted}
                  placeholder="https://ilp.rafiki.money/alice"
                />
              </div>
              <Label className="text-base" htmlFor="amount">
                Amount
              </Label>
              <Input
                id="amount"
                name="amount"
                icon={<DollarSign />}
                onInput={handleChange}
                disabled={paymentStarted}
                placeholder="20.00"
              />

              <div className="mt-5 w-full">
                {paymentStarted ? (
                  <Button
                    className="text-base"
                    fullWidth
                    aria-label="stop"
                    type="button"
                    onClick={stopPayments}>
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    className="text-base"
                    type="submit"
                    aria-label="connect"
                    loading={loading}>
                    Connect
                  </Button>
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
