import { MonetizationTagManager } from '@/content/monetizationTagManager/MonetizationTagManager'

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

export const initMonetizationTagManager = () => {
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
      // console.log('start monetization')
    }
  }

  const monetizationTagManager = new MonetizationTagManager(
    window,
    document,
    onPaymentDetailsChange,
  )

  monetizationTagManager.startWhenDocumentReady()
}
