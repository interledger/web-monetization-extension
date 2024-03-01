import { tabs } from 'webextension-polyfill'

import Background from '@/background/background'
import { PaymentFlowService } from '@/background/paymentFlow'

export type SetIncomingPointerData = {
  incomingPayment: string
  paymentPointer: string
  amount: string
}

const setIncomingPointerCallback = async (
  data: SetIncomingPointerData,
  background: Background
) => {
  const {
    incomingPayment: receivingPaymentPointerUrl,
    paymentPointer: sendingPaymentPointerUrl,
    amount
  } = data

  if (
    background.grantFlow?.sendingPaymentPointerUrl === sendingPaymentPointerUrl
  ) {
    if (!background.paymentStarted) {
      background.paymentStarted = true
      const currentTabId = await background.grantFlow?.getCurrentActiveTabId()
      await tabs.sendMessage(currentTabId ?? 0, { type: 'START_PAYMENTS' })
    }
  } else {
    background.grantFlow = new PaymentFlowService(
      sendingPaymentPointerUrl,
      receivingPaymentPointerUrl,
      amount
    )

    background.grantFlow.initPaymentFlow()
  }

  return true
}

export default {
  callback: setIncomingPointerCallback,
  type: 'SET_INCOMING_POINTER'
}
