import { runtime, tabs } from 'webextension-polyfill'

import { PaymentFlowService } from '@/background/grantFlow'

import getSendingPaymentPointerHandler from '../messageHandlers/getSendingPaymentPointerHandler'
import isMonetizationReadyHandler from '../messageHandlers/isMonetizationReadyHandler'
import setIncomingPointerHandler from '../messageHandlers/setIncomingPointerHandler'
import { tabChangeHandler, tabUpdateHandler } from './tabHandlers'

class Background {
  private messageHandlers: any = [
    isMonetizationReadyHandler,
    setIncomingPointerHandler,
    getSendingPaymentPointerHandler,
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
}

export default Background
