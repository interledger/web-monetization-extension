import { type Browser } from 'webextension-polyfill'

// export const sendMessage = (
//   msg: EXTMessage,
//   options?: Runtime.SendMessageOptionsType,
// ): Promise<EXTResponse> => {
//   return runtime.sendMessage(msg, options)
// }

// export const sendMessageToTab = <T = any>(
//   tab: Tabs.Tab,
//   msg: EXTMessage<T>,
//   options?: Tabs.SendMessageOptionsType,
// ): Promise<EXTResponse> => {
//   return tabs.sendMessage(tab.id as number, msg, options)
// }

// export const sendMessageToActiveTab = async <T = any>(
//   msg: EXTMessage<T>,
//   options?: Tabs.SendMessageOptionsType,
// ): Promise<EXTResponse> => {
//   let activeTab: Tabs.Tab
//   try {
//     const activeTabs = await tabs.query({ active: true, currentWindow: true })
//     activeTab = activeTabs[0]
//   } catch (error) {
//     console.log('[===== Error in sendMessageToActiveTab =====]', error)
//     throw `Error in sendMessageToActiveTab`
//   }
//   return sendMessageToTab(activeTab, msg, options)
// }

export class Message<T> {
  constructor(private browser: Browser) {}

  async send(message: T) {
    return await this.browser.runtime.sendMessage(message)
  }
}
