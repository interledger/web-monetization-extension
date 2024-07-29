import type { Browser, Runtime } from 'webextension-polyfill'
import {
  BACKGROUND_TO_POPUP_CONNECTION_NAME as CONNECTION_NAME,
  type BackgroundToPopupMessage,
  type BackgroundToPopupMessagesMap
} from '@/shared/messages'

export class SendToPopup {
  private isConnected = false
  private port: Runtime.Port
  private queue = new Map<keyof BackgroundToPopupMessagesMap, any>()

  constructor(private browser: Browser) {}

  start() {
    this.browser.runtime.onConnect.addListener((port) => {
      if (port.name !== CONNECTION_NAME) return
      if (port.error) {
        return
      }
      this.port = port
      this.isConnected = true
      for (const [type, data] of this.queue) {
        this.send(type, data)
        this.queue.delete(type)
      }
      port.onDisconnect.addListener(() => {
        this.isConnected = false
      })
    })
  }

  get isPopupOpen() {
    return this.isConnected
  }

  async send<T extends keyof BackgroundToPopupMessagesMap>(
    type: T,
    data: BackgroundToPopupMessagesMap[T]
  ) {
    if (!this.isConnected) {
      this.queue.set(type, data)
      return
    }
    const message = { type, data } as BackgroundToPopupMessage
    this.port.postMessage(message)
  }
}
