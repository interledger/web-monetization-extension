import Background from '@/background/Background'

const pausePaymentCallback = async (data: undefined, background: Background) => {
  background.paymentStarted = false

  return true
}

export default { callback: pausePaymentCallback, type: 'PAUSE_PAYMENT' }
