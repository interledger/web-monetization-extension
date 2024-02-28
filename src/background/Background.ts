import { type Browser, Runtime } from 'webextension-polyfill'

import { type PaymentFlowService } from '@/background/paymentFlow'
import { setStorageDefaultData } from '@/utils/storage'
import { EXTMessage } from '@/utils/types'

import { generateKeysHandler } from './installHandlers'
import {
  getSendingPaymentPointerHandler,
  getStorageData,
  getStorageKey,
  isMonetizationReadyHandler,
  runPaymentHandler,
  setIncomingPointerHandler,
  setStorageData,
  setStorageKey,
} from './messageHandlers'
import { EventsService } from './services'
import { tabChangeHandler, tabUpdateHandler } from './tabHandlers'

class Background {
  private messageHandlers: any = [
    isMonetizationReadyHandler,
    setIncomingPointerHandler,
    getSendingPaymentPointerHandler,
    runPaymentHandler,
    getStorageData,
    getStorageKey,
    setStorageKey,
    setStorageData,
  ]
  private subscriptions: any = []
  // TO DO: remove these from background into storage or state & use injection
  grantFlow: PaymentFlowService | null = null
  spentAmount: number = 0
  paymentStarted = false

  constructor(
    private browser: Browser,
    private eventsService: EventsService,
  ) {
    setStorageDefaultData()
  }

  setupEvents() {
    this.browser.runtime.onMessage.addListener(async (message: EXTMessage) => {
      switch (message.type) {
        case 'GET_STORAGE_DATA':
          return await this.eventsService.getStorageData()

        default:
          return
      }
    })
  }

  subscribeToMessages() {
    this.subscriptions = this.messageHandlers.map((handler: any) => {
      const listener: any = (
        message: EXTMessage,
        sender: Runtime.MessageSender,
        sendResponse: (_res: any) => void,
      ) => {
        if (handler.type === message.type) {
          handler
            .callback(message.data, this)
            .then((res: any) => {
              sendResponse(res)
            })
            .catch((error: any) => {
              console.log('[===== Error in MessageListener =====]', error)

              sendResponse(error)
            })
        }

        return true
      }

      this.browser.runtime.onMessage.addListener(listener)

      return () => {
        this.browser.runtime.onMessage.removeListener(listener)
      }
    })
  }

  subscribeToTabChanges() {
    //Add Update listener for tab
    this.browser.tabs.onUpdated.addListener(tabUpdateHandler)

    //Add tab change listener
    this.browser.tabs.onActivated.addListener(tabChangeHandler)
  }

  subscribeToInstall() {
    this.browser.runtime.onInstalled.addListener(generateKeysHandler)
  }

  unsubscribeFromMessages() {
    this.subscriptions.forEach((sub: any) => sub())
  }
}
export default Background
