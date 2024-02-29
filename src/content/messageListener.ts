import { PaymentSender } from '@/content/monetization'
import { EXTMessage, EXTResponse } from '@/utils/types'

const paymentSender = new PaymentSender()

export const onRequest = async (msg: EXTMessage): Promise<EXTResponse | undefined> => {
  switch (msg.type) {
    case 'LOAD': {
      const monetizationTag = document.querySelector('link[rel="monetization"]')
      monetizationTag?.dispatchEvent(new Event('load'))
      break
    }

    case 'IS_MONETIZATION_READY': {
      const monetizationTag = document.querySelector('link[rel="monetization"]')

      return {
        type: 'SUCCESS',
        data: {
          monetization: !!monetizationTag,
          paymentPointer: monetizationTag?.getAttribute('href'),
        },
      }
    }

    // case 'START_PAYMENTS': {
    //   paymentSender.start()
    //   break
    // }

    // case 'STOP_PAYMENTS': {
    //   paymentSender.stop()
    //   break
    // }

    case 'PAYMENT_SUCCESS': {
      const { receiveAmount, incomingPayment, paymentPointer } = msg.data

      window.dispatchEvent(
        new CustomEvent('monetization-v2', {
          detail: {
            amount: receiveAmount.value as string,
            assetCode: receiveAmount.assetCode as string,
            assetScale: receiveAmount.assetScale as number,
            amountSent: {
              currency: receiveAmount.assetCode as string,
              amount: (receiveAmount.value * 10 ** -receiveAmount.assetScale) as number,
            },
            paymentPointer: paymentPointer as string,
            incomingPayment: incomingPayment as string,
            receipt: null,
          },
        }),
      )

      break
    }

    default:
      return { type: 'SUCCESS' }
  }
}

export default onRequest
