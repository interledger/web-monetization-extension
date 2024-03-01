import { runtime } from 'webextension-polyfill'

import Background from '@/background/background'

const runPaymentCallback = async (data: undefined, background: Background) => {
  if (background.grantFlow) {
    background.grantFlow.sendPayment()
    background.spentAmount = Number(
      parseFloat(String(background.spentAmount + 1000000 / 10 ** 9)).toFixed(3),
    )
    runtime.sendMessage({
      type: 'SPENT_AMOUNT',
      data: { spentAmount: background.spentAmount },
    })
    background.paymentStarted = true
  }

  return true
}

export default { callback: runPaymentCallback, type: 'RUN_PAYMENT' }
