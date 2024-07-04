import type { AmountValue, Storage } from '@/shared/types'
import type { Browser, Runtime } from 'webextension-polyfill'

interface BackgroundToPopupMessages {
  SET_BALANCE: Record<'recurring' | 'oneTime' | 'total', AmountValue>
  SET_STATE: { state: Storage['state']; prevState: Storage['state'] }
}

export type BackgroundToPopupMessage = {
  [K in keyof BackgroundToPopupMessages]: {
    type: K
    data: BackgroundToPopupMessages[K]
  }
}[keyof BackgroundToPopupMessages]

export const CONNECTION_NAME = 'popup'

export class SendToPopup {
  private isConnected = false
  private port: Runtime.Port

  constructor(private browser: Browser) {}

  start() {
    this.browser.runtime.onConnect.addListener((port) => {
      if (port.name !== CONNECTION_NAME) return
      if (port.error) {
        return
      }
      this.port = port
      this.isConnected = true
      port.onDisconnect.addListener(() => {
        this.isConnected = false
      })
    })
  }

  get isPopupOpen() {
    return this.isConnected
  }

  async send<T extends keyof BackgroundToPopupMessages>(
    type: T,
    data: BackgroundToPopupMessages[T]
  ) {
    if (!this.isConnected) {
      return
    }
    const message = { type, data } as BackgroundToPopupMessage
    this.port.postMessage(message)
  }
}
