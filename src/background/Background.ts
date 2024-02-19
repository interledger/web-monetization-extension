import { Runtime, runtime, storage as storageApi, tabs } from 'webextension-polyfill'

import { PaymentFlowService } from '@/background/grantFlow'
import { defaultData } from '@/utils/storage'

import {
  getSendingPaymentPointerHandler,
  getStorageData,
  getStorageKey,
  isMonetizationReadyHandler,
  setIncomingPointerHandler,
  setStorageKey,
} from '../messageHandlers'
import { tabChangeHandler, tabUpdateHandler } from './tabHandlers'

const storage = storageApi.sync || storageApi.local

class Background {
  private messageHandlers: any = [
    isMonetizationReadyHandler,
    setIncomingPointerHandler,
    getSendingPaymentPointerHandler,
    getStorageData,
    getStorageKey,
    setStorageKey,
  ]
  private subscriptions: any = []
  // TO DO: remove these from background into storage or state & use injection
  grantFlow: PaymentFlowService | null = null
  spentAmount: number = 0
  paymentStarted = false

  constructor() {
    this.setStorageDefaultData()
  }

  async setStorageDefaultData() {
    try {
      await storage.set({ data: defaultData })
    } catch (error) {
      console.error('Error storing data:', error)
    }
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

  unsubscribeFromMessages() {
    this.subscriptions.forEach((sub: any) => sub())
  }
}

export default Background
