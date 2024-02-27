import { bytesToHex } from '@noble/hashes/utils'
import { Runtime, runtime, tabs } from 'webextension-polyfill'

import { type PaymentFlowService } from '@/background/paymentFlow'
import { exportJWK, generateEd25519KeyPair } from '@/utils/crypto'
import { defaultData, storageApi } from '@/utils/storage'

import {
  getSendingPaymentPointerHandler,
  getStorageData,
  getStorageKey,
  isMonetizationReadyHandler,
  runPaymentHandler,
  setIncomingPointerHandler,
  setStorageKey,
} from '../messageHandlers'
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
      await storageApi.set({ ...defaultData })
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
  private async keyExists(): Promise<boolean> {
    const data = await storageApi.get(['privateKey', 'publicKey', 'keyId'])
    if (data.privateKey && data.publicKey && data.keyId) {
      return true
    }

    return false
  }

  async onInstalled() {
    runtime.onInstalled.addListener(async () => {
      if (await this.keyExists()) return
      const { privateKey, publicKey } = generateEd25519KeyPair()
      const keyId = crypto.randomUUID()
      const jwk = exportJWK(publicKey, keyId)

      await storageApi.set({
        privateKey: bytesToHex(privateKey),
        publicKey: btoa(JSON.stringify(jwk)),
        keyId,
      })
    })
  }
}
export default Background
