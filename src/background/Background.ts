import { Runtime, runtime, tabs } from 'webextension-polyfill'

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

  constructor() {
    setStorageDefaultData()
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

      runtime.onMessage.addListener(listener)

      return () => {
        runtime.onMessage.removeListener(listener)
      }
    })
  }

  subscribeToTabChanges() {
    //Add Update listener for tab
    tabs.onUpdated.addListener(tabUpdateHandler)

    //Add tab change listener
    tabs.onActivated.addListener(tabChangeHandler)
  }

  subscribeToInstall() {
    runtime.onInstalled.addListener(generateKeysHandler)
  }

  unsubscribeFromMessages() {
    this.subscriptions.forEach((sub: any) => sub())
  }
}
export default Background
