// import { Runtime } from 'webextension-polyfill'

import { PaymentSender } from '@/content/monetization'

const paymentSender = new PaymentSender()

export const onRequest = async (
  msg: EXTMessage,
  // sender: Runtime.SendMessageOptionsType,
): Promise<EXTResponse | undefined> => {
  // console.log('~~~~~~~', msg)

  switch (msg.type) {
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

    case 'START_PAYMENTS': {
      paymentSender.start()
      break
    }

    case 'STOP_PAYMENTS': {
      paymentSender.stop()
      break
    }
    default:
      return { type: 'SUCCESS' }
  }
}

export default onRequest
