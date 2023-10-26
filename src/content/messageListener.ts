// import { Runtime } from 'webextension-polyfill'

export const onRequest = async (
  msg: EXTMessage,
  // sender: Runtime.SendMessageOptionsType,
): Promise<EXTResponse | undefined> => {
  // console.log('~~~~~~~', msg, sender)

  switch (msg.type) {
    case 'IS_MONETIZATION_READY': {
      const monetizationTag = document.querySelector('link[rel="monetization"]')

      return {
        type: 'SUCCESS',
        data: { monetization: !!monetizationTag, pointer: monetizationTag?.getAttribute('href') },
      }
    }
    default:
      return { type: 'SUCCESS' }
  }
}

export default onRequest
