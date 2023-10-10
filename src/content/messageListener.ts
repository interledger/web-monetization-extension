import { Runtime } from 'webextension-polyfill'

export const onRequest = async (
  msg: EXTMessage,
  sender: Runtime.SendMessageOptionsType,
): Promise<EXTResponse | undefined> => {
  console.log('~~~~~~~', msg, sender)

  switch (msg.type) {
    case 'IS_MONETIZATION_READY': {
      const link = document.querySelector('link[rel="monetization"]')
      break
    }
    default:
      return { type: 'SUCCESS' }
  }
}

export default onRequest
