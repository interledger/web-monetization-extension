import { Runtime } from 'webextension-polyfill'

export const onRequest = async (
  msg: EXTMessage,
  sender: Runtime.SendMessageOptionsType,
): Promise<EXTResponse | undefined> => {
  console.log('~~~~~~~', msg, sender)

  switch (msg.type) {
    case 'IS_MONETIZATION_READY': {
      const monetizationTag = document.querySelector('link[rel="monetization"]')

      if (monetizationTag) {
        const paymentPointer = monetizationTag.getAttribute('href') || ''

        const eventOptions = {
          bubbles: true,
          composed: true,
          detail: {
            amount: '1',
            assetCode: 'USD',
            assetScale: '9',
            receipt: null,
            amountSent: {
              amount: '0.01',
              currency: 'USD',
            },
            paymentPointer: paymentPointer,
            incomingPayment: paymentPointer,
          },
        }
        const customEvent = new CustomEvent('monetization', eventOptions)

        monetizationTag.dispatchEvent(new CustomEvent('load', eventOptions))
        console.log('dispatching event')
        monetizationTag.dispatchEvent(customEvent)

        // setInterval(() => {
        console.log('dispatching event')
        monetizationTag.dispatchEvent(customEvent)
        // }, 1000)
      }

      return { type: 'SUCCESS', data: { monetization: !!monetizationTag } }
    }
    default:
      return { type: 'SUCCESS' }
  }
}

export default onRequest
