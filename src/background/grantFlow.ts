import { tabs } from 'webextension-polyfill'

import { getAxiosInstance } from '@/background/requestConfig'

const KEY_ID = '530c7caf-47a2-4cbd-844e-b8ed53e5c0d7'
const PRIVATE_KEY =
  'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSU1xYkZodTlNZHpjNXZROXBoVDY0aGZ4Z0pRazM2TFVyR1VqL1cwbHRTWG0KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo='
const WM_PAYMENT_POINTER_URL = 'https://ilp.rafiki.money/web-monetization' // intermediarul

export class PaymentFlowService {
  axiosInstance = getAxiosInstance(KEY_ID, PRIVATE_KEY)

  sendingPaymentPointerUrl: string
  receivingPaymentPointerUrl: string

  incomingPaymentUrlId: string
  quoteUrlId: string
  outgoingPaymentGrantData: any

  clientAuthToken: string
  quoteGrantToken: string
  outgoingPaymentGrantToken: string
  continuationRequestToken: string
  interactRef: string

  amount: string

  constructor(
    sendingPaymentPointerUrl: string,
    receivingPaymentPointerUrl: string,
    amount: string,
  ) {
    this.sendingPaymentPointerUrl = sendingPaymentPointerUrl
    this.receivingPaymentPointerUrl = receivingPaymentPointerUrl
    this.amount = amount
  }

  async initPaymentFlow() {
    await this.getClientAuth()
    await this.getIncomingPaymentUrlId()
    await this.getQuoteGrant()
    await this.getQuote()
    await this.getOutgoingPaymentGrant()
    await this.confirmPayment()
    await this.getContinuationRequest()
    await this.runPayment()
  }

  getHeaders(gnapToken: string) {
    return {
      headers: {
        Authorization: `GNAP ${gnapToken}`,
      },
    }
  }

  async getClientAuth() {
    const payload = {
      access_token: {
        access: [
          {
            type: 'incoming-payment',
            actions: ['create', 'read', 'list'],
            identifier: this.receivingPaymentPointerUrl,
          },
        ],
      },
      client: WM_PAYMENT_POINTER_URL,
    }

    const response = await this.axiosInstance.post('https://auth.rafiki.money/', payload)

    if (!response.data.access_token.value) {
      throw new Error('No client auth')
    }
    this.clientAuthToken = response.data.access_token.value
  }

  async getIncomingPaymentUrlId() {
    const incomingPayment = await this.axiosInstance.post(
      `${this.receivingPaymentPointerUrl}/incoming-payments`,
      {},
      this.getHeaders(this.clientAuthToken),
    )

    if (!incomingPayment?.data?.id) {
      throw new Error('No incoming payment id')
    }

    this.incomingPaymentUrlId = incomingPayment.data.id
  }

  async getQuoteGrant() {
    const quotePayload = {
      access_token: {
        access: [
          {
            type: 'quote',
            actions: ['create'],
            identifier: this.sendingPaymentPointerUrl,
          },
        ],
      },
      client: WM_PAYMENT_POINTER_URL,
    }
    const quoteGrant = await this.axiosInstance.post('https://auth.rafiki.money/', quotePayload)

    if (!quoteGrant.data?.access_token?.value) {
      throw new Error('No quote grant')
    }

    this.quoteGrantToken = quoteGrant.data.access_token.value
  }

  async getQuote() {
    const payload = {
      receiver: this.incomingPaymentUrlId,
      debitAmount: {
        value: '1000',
        assetCode: 'USD',
        assetScale: 2,
      },
    }

    const quote = await this.axiosInstance.post(
      `${this.sendingPaymentPointerUrl}/quotes`,
      payload,
      this.getHeaders(this.quoteGrantToken),
    )

    if (!quote.data.id) {
      throw new Error('No quote url id')
    }

    this.quoteUrlId = quote.data.id
  }

  async getOutgoingPaymentGrant() {
    const receivingPaymentPointerDetails = await this.axiosInstance.get(
      this.receivingPaymentPointerUrl,
    )
    console.log('receivingPaymentPointerDetails', receivingPaymentPointerDetails)
    const payload = {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['create', 'read', 'list'],
            identifier: this.sendingPaymentPointerUrl,
            limits: {
              debitAmount: {
                value: '2000',
                assetScale: 2,
                assetCode: 'USD',
              },
            },
          },
        ],
      },
      client: WM_PAYMENT_POINTER_URL,
      interact: {
        start: ['redirect'],
        finish: {
          method: 'redirect',
          uri: `https://rafiki.money/`,
          nonce: new Date().getTime().toString(),
        },
      },
    }

    const outgoingPaymentGrant = await this.axiosInstance.post(
      'https://auth.rafiki.money/',
      payload,
    )

    if (!outgoingPaymentGrant.data.interact.redirect) {
      throw new Error('No redirect')
    }

    this.outgoingPaymentGrantToken = outgoingPaymentGrant.data.continue.access_token.value
    this.outgoingPaymentGrantData = outgoingPaymentGrant.data
  }

  async getContinuationRequest() {
    const continuationRequest = await this.axiosInstance.post(
      this.outgoingPaymentGrantData.continue.uri,
      {
        interact_ref: this.interactRef,
      },
      this.getHeaders(this.outgoingPaymentGrantToken),
    )

    if (!continuationRequest.data.access_token.value) {
      throw new Error('No continuation request')
    }

    this.continuationRequestToken = continuationRequest.data.access_token.value
  }

  async runPayment() {
    const payload = {
      quoteId: this.quoteUrlId,
    }

    const outgoingPayment = await this.axiosInstance.post(
      `${this.sendingPaymentPointerUrl}/outgoing-payments`,
      payload,
      this.getHeaders(this.continuationRequestToken),
    )

    console.log('outgoingPayment', outgoingPayment)
  }

  async confirmPayment() {
    const currentTabId = await this.getCurrentActiveTabId()
    console.log('currentTabId', currentTabId)

    return await new Promise(resolve => {
      if (this.outgoingPaymentGrantData.interact.redirect) {
        const url = this.outgoingPaymentGrantData.interact.redirect

        tabs.create({ url }).then(tab => {
          if (tab.id) {
            tabs.onUpdated.addListener((tabId, changeInfo) => {
              if (tabId === tab.id && changeInfo.url?.includes('interact_ref')) {
                this.interactRef = changeInfo.url.split('interact_ref=')[1]
                tabs.update(currentTabId, { active: true })
                tabs.remove(tab.id)
                resolve(true)
              }
            })
          }
        })
      }
    })
  }

  async getCurrentActiveTabId() {
    const activeTabs = await tabs.query({ active: true, currentWindow: true })
    return activeTabs[0].id
  }
}
