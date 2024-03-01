import Background from '@/background/background'

const getSendingPaymentPointerCallback = async (
  data: undefined,
  background: Background
) => {
  if (background.grantFlow) {
    const { sendingPaymentPointerUrl, amount } = background.grantFlow
    return {
      type: 'SUCCESS',
      data: {
        sendingPaymentPointerUrl,
        amount,
        started: background.paymentStarted
      }
    }
  }

  return {
    type: 'ERROR',
    data: { sendingPaymentPointerUrl: '' }
  }
}

export default {
  callback: getSendingPaymentPointerCallback,
  type: 'GET_SENDING_PAYMENT_POINTER'
}
