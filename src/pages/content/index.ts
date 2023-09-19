/* disable eslint */
import { MonetizationTagManager } from '@/lib/monetizationTagManager/MonetizationTagManager'
import { wmPolyfill } from '@/polyfills/wmPolyfill'

import('./components/App')

interface PaymentDetailsChangeArguments {
  started: PaymentDetails | null
  stopped: PaymentDetails | null
}

interface PaymentDetails {
  requestId: string
  paymentPointer: string
  initiatingUrl: string
  fromBody: boolean
  tagType: 'link'
  attrs: Record<string, string | null>
}

function appendScript() {
  const script = document.createElement('script')
  script.innerHTML = wmPolyfill
  document.documentElement.prepend(script)
}

if (document.readyState === 'interactive' || document.readyState === 'loading') {
  appendScript()
} else {
  document.addEventListener('DOMContentLoaded', appendScript)
}
const onPaymentDetailsChange = (details: PaymentDetailsChangeArguments) => {
  const { started, stopped } = details
  if (stopped) {
    // debug('sending stopped request', JSON.stringify(stopped, null, 2))
    // this.stopMonetization(stopped)
    console.log('stop monetization')
  }
  if (started) {
    // debug('sending start request', JSON.stringify(started, null, 2))
    // void this.startMonetization(started)
    console.log('start monetization')
  }
}

const monetizationTagManager = new MonetizationTagManager(window, document, onPaymentDetailsChange)

monetizationTagManager.startWhenDocumentReady()
