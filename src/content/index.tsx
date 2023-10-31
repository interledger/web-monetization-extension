import { runtime } from 'webextension-polyfill'

import { initMonetizationTagManager } from '@/utils/monetizationTagManager'
import { wm2Polyfill } from '@/utils/polyfill'

import { loadObserver } from './linksObserver'
import MessageListener from './messageListener'

// import "./content.css";

runtime.onMessage.addListener(MessageListener)

function inject(configure: (_script: HTMLScriptElement) => void) {
  const script = document.createElement('script')
  configure(script)
  document.documentElement.appendChild(script)
  // document.documentElement.removeChild(script)
}

// eslint-disable-next-line @typescript-eslint/no-extra-semi
;(function injectCode(code: string) {
  inject(script => (script.innerHTML = code))
})(wm2Polyfill)

loadObserver()
initMonetizationTagManager()

// testing monetization events
const monetizationTag = document.querySelector('link[rel="monetization"]')
if (monetizationTag) {
  const paymentPointer = monetizationTag.getAttribute('href') || ''

  const eventOptions = {
    bubbles: true,
    composed: true,
    detail: {
      amount: '1',
      assetCode: 'USD',
      assetScale: '2',
      receipt: null,
      amountSent: {
        amount: '1', // 0.01
        currency: 'USD',
      },
      paymentPointer: paymentPointer,
      incomingPayment: paymentPointer,
    },
  }
  const customEvent = new CustomEvent('monetization', eventOptions)

  monetizationTag.dispatchEvent(new CustomEvent('load', eventOptions))
  monetizationTag.dispatchEvent(customEvent)

  setInterval(() => {
    monetizationTag.dispatchEvent(customEvent)
  }, 1000 * 60) // 1 minute
}
