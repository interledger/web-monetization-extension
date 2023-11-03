import { tabs } from 'webextension-polyfill'

import { getAxiosInstance } from '@/background/requestConfig'

const KEY_ID = 'f9eb6bfe-26d2-46a8-88fd-b8b6c56132ad'
const PRIVATE_KEY =
  'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1DNENBUUF3QlFZREsyVndCQ0lFSUgwcDgzZ2dmYTUyNUw1K1BJbkZ1SHoxUFdZQzRFKy9UTEl1R09NMFRMTXcKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo='
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
  walletAddressId: string

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
    await this.getWalletAddress()
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

  async getWalletAddress() {
    const response = await this.axiosInstance.get(
      this.receivingPaymentPointerUrl,
      this.getHeaders(this.clientAuthToken),
    )

    if (!response?.data?.id) {
      throw new Error('No client auth')
    } else {
      this.walletAddressId = response.data.id
    }
  }

  async getIncomingPaymentUrlId() {
    const incomingPayment = await this.axiosInstance.post(
      new URL(this.receivingPaymentPointerUrl).origin + '/incoming-payments',
      {
        walletAddress: this.receivingPaymentPointerUrl,
      },
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
      method: 'ilp',
      receiver: this.incomingPaymentUrlId,
      walletAddress: this.sendingPaymentPointerUrl,
      debitAmount: {
        value: '1000',
        assetCode: 'USD',
        assetScale: 2,
      },
    }

    const quote = await this.axiosInstance.post(
      new URL(this.sendingPaymentPointerUrl).origin + '/quotes',
      payload,
      this.getHeaders(this.quoteGrantToken),
    )

    if (!quote.data.id) {
      throw new Error('No quote url id')
    }

    this.quoteUrlId = quote.data.id
  }

  async getOutgoingPaymentGrant() {
    // const receivingPaymentPointerDetails = await this.axiosInstance.get(
    //   this.receivingPaymentPointerUrl,
    // )
    console.log('walletAddress id', this.walletAddressId)
    const payload = {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['list', 'list-all', 'read', 'read-all', 'create'],
            identifier: this.sendingPaymentPointerUrl, // sendingPaymentPointerUrl
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
      'https://auth.rafiki.money',
      payload,
      this.getHeaders(this.clientAuthToken),
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
