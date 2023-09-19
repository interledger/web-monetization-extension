import { BrowserAPI } from '@/lib/index'
import { addMessageListener, sendRuntimeMessage } from '@/lib/messageUtils'

export const initListeners = () => {
  const monetization = document.querySelector('link[rel="monetization"]')
  sendRuntimeMessage('MONETIZATION_START', !!monetization)

  addMessageListener(({ action }, sender, sendResponse) => {
    if (action === 'GET_MONETIZATION') {
      sendResponse(!!monetization)
    }

    return true
  })

  if (monetization) {
    const paymentPointer = monetization.getAttribute('href') || ''

    const eventOptions = {
      bubbles: true,
      composed: true,
      detail: {
        amount: '1',
        assetCode: 'USD',
        assetScale: '9',
        receipt: null,
        amountSent: {
          amount: '0.01',
          currency: 'USD',
        },
        paymentPointer: paymentPointer,
        incomingPayment: paymentPointer,
      },
    }
    const customEvent = new CustomEvent('monetization', eventOptions)

    monetization.dispatchEvent(new CustomEvent('load', eventOptions))
    console.log('dispatching event')
    monetization.dispatchEvent(customEvent)

    setInterval(() => {
      console.log('dispatching event')
      monetization.dispatchEvent(customEvent)
    }, 1000)
  }
}

// eslint-disable-next-line no-unused-vars
type TabChangeListener = (activeInfo: chrome.tabs.TabActiveInfo) => void

export function addTabChangeListener(listener: TabChangeListener) {
  BrowserAPI.tabs.onActivated.addListener(listener)
}
