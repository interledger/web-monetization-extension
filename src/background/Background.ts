import { bytesToHex } from '@noble/hashes/utils'
import browser, { Runtime, runtime, tabs } from 'webextension-polyfill'

import { PaymentFlowService } from '@/background/grantFlow'
import { exportJWK, generateEd25519KeyPair } from '@/utils/crypto'
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

  // TODO: to be moved to a service
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

  // TODO: Move to storage wrapper once available
  private async keyExists(): Promise<boolean> {
    return new Promise(res => {
      chrome.storage.local.get(['privateKey', 'publicKey', 'kid'], data => {
        if (data.privateKey && data.publicKey && data.kid) {
          res(true)
        } else {
          res(false)
        }
      })
    })
  }

  async onInstalled() {
    chrome.runtime.onInstalled.addListener(async () => {
      if (await this.keyExists()) return
      const { privateKey, publicKey } = generateEd25519KeyPair()
      const kid = crypto.randomUUID()
      const jwk = exportJWK(publicKey, kid)

      chrome.storage.local.set({
        privateKey: bytesToHex(privateKey),
        publicKey: btoa(JSON.stringify(jwk)),
        kid,
      })
    })
  }
}

export default Background
