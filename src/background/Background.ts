import { bytesToHex } from '@noble/hashes/utils'
import { runtime, tabs } from 'webextension-polyfill'

import { type PaymentFlowService } from '@/background/paymentFlow'
import { exportJWK, generateEd25519KeyPair } from '@/utils/crypto'

import getSendingPaymentPointerHandler from '../messageHandlers/getSendingPaymentPointerHandler'
import isMonetizationReadyHandler from '../messageHandlers/isMonetizationReadyHandler'
import setIncomingPointerHandler from '../messageHandlers/setIncomingPointerHandler'
import runPaymentHandler from '../messageHandlers/runPaymentHandler'
import { tabChangeHandler, tabUpdateHandler } from './tabHandlers'

class Background {
  private messageHandlers: any = [
    isMonetizationReadyHandler,
    setIncomingPointerHandler,
    getSendingPaymentPointerHandler,
    runPaymentHandler,
  ]
  private subscriptions: any = []
  // TO DO: remove these from background into storage or state & use injection
  grantFlow: PaymentFlowService | null = null
  spentAmount: number = 0
  paymentStarted = false

  constructor() {}

  subscribeToMessages() {
    this.subscriptions = this.messageHandlers.map((handler: any) => {
      const listener: any = async (message: EXTMessage) => {
        console.log(handler.type, message.type)
        if (handler.type === message.type) {
          try {
            await handler.callback(message.data, this)
          } catch (error) {
            console.log('[===== Error in MessageListener =====]', error)
            return error
          }
        }
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
    return new Promise(res => {
      chrome.storage.local.get(['privateKey', 'publicKey', 'keyId'], data => {
        if (data.privateKey && data.publicKey && data.keyId) {
          res(true)
        } else {
          res(false)
        }
      })
    })
  }

  async onInstalled() {
    chrome.storage.local.get(['privateKey', 'publicKey', 'keyId'], console.log)
    chrome.runtime.onInstalled.addListener(async () => {
      if (await this.keyExists()) return
      const { privateKey, publicKey } = generateEd25519KeyPair()
      const keyId = crypto.randomUUID()
      const jwk = exportJWK(publicKey, keyId)

      chrome.storage.local.set({
        privateKey: bytesToHex(privateKey),
        publicKey: btoa(JSON.stringify(jwk)),
        keyId,
      })
    })
  }
}

export default Background
