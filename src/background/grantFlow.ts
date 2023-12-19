import { tabs } from 'webextension-polyfill'

import { WM_WALLET_ADDRESS } from '@/background/config'
import { getAxiosInstance } from '@/background/requestConfig'

export class PaymentFlowService {
  axiosInstance = getAxiosInstance()

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

  manageUrl: string

  amount: string | number

  sendingWalletAddress: any
  receivingWalletAddress: any

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
    this.sendingWalletAddress = await this.getWalletAddress(this.sendingPaymentPointerUrl)
    this.receivingWalletAddress = await this.getWalletAddress(this.receivingPaymentPointerUrl)

    await this.getIncomingPaymentGrant()
    await this.getIncomingPaymentUrlId()
    await this.getQuoteGrant()
    await this.getOutgoingPaymentGrant()
    await this.confirmPayment()
    await this.getContinuationRequest()

    const currentTabId = await this.getCurrentActiveTabId()
    await tabs.sendMessage(currentTabId ?? 0, { type: 'START_PAYMENTS' })

    // await this.createQuote()
    // await this.runPayment()
  }

  getHeaders(gnapToken: string) {
    return {
      headers: {
        Authorization: `GNAP ${gnapToken}`,
      },
    }
  }

  async getWalletAddress(paymentPointerUrl: string) {
    const response = await this.axiosInstance.get(paymentPointerUrl, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response?.data?.id) {
      throw new Error('No client auth')
    }

    return response.data
  }

  async getIncomingPaymentGrant() {
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
      client: WM_WALLET_ADDRESS,
    }

    const response = await this.axiosInstance.post(
      this.receivingWalletAddress.authServer + '/',
      payload,
    )

    if (!response.data.access_token.value) {
      throw new Error('No client auth')
    }
    this.clientAuthToken = response.data.access_token.value
  }

  async getIncomingPaymentUrlId() {
    const incomingPayment = await this.axiosInstance.post(
      new URL(this.receivingPaymentPointerUrl).origin + '/incoming-payments',
      {
        walletAddress: this.receivingPaymentPointerUrl,
        expiresAt: new Date(Date.now() + 6000 * 60 * 10).toISOString(),
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
      client: WM_WALLET_ADDRESS,
    }
    const quoteGrant = await this.axiosInstance.post(
      this.sendingWalletAddress.authServer + '/',
      quotePayload,
    )

    if (!quoteGrant.data?.access_token?.value) {
      throw new Error('No quote grant')
    }

    this.quoteGrantToken = quoteGrant.data.access_token.value
  }

  async createQuote() {
    const payload = {
      method: 'ilp',
      receiver: this.incomingPaymentUrlId,
      walletAddress: this.sendingPaymentPointerUrl,
      debitAmount: {
        value: '1000000', // 0.001 USD
        assetCode: 'USD',
        assetScale: 9,
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
    const payload = {
      access_token: {
        access: [
          {
            type: 'outgoing-payment',
            actions: ['list', 'list-all', 'read', 'read-all', 'create'],
            identifier: this.sendingPaymentPointerUrl, // sendingPaymentPointerUrl
            limits: {
              debitAmount: {
                value: String(Number(this.amount) * 10 ** 9), // '1000000000',
                assetScale: 9,
                assetCode: 'USD',
              },
            },
          },
        ],
      },
      client: WM_WALLET_ADDRESS,
      interact: {
        start: ['redirect'],
        finish: {
          method: 'redirect',
          uri: `http://localhost:3035`,
          nonce: new Date().getTime().toString(),
        },
      },
    }

    const outgoingPaymentGrant = await this.axiosInstance.post(
      this.sendingWalletAddress.authServer + '/',
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

    this.manageUrl = continuationRequest.data.access_token.manage
    this.continuationRequestToken = continuationRequest.data.access_token.value
  }

  async runPayment() {
    const payload = {
      walletAddress: this.sendingPaymentPointerUrl,
      quoteId: this.quoteUrlId,
    }

    const response = await this.axiosInstance.post(
      new URL(this.sendingPaymentPointerUrl).origin + '/outgoing-payments',
      payload,
      this.getHeaders(this.continuationRequestToken),
    )

    const {
      receiveAmount,
      receiver: incomingPayment,
      walletAddress: paymentPointer,
    } = response.data
    const currentTabId = await this.getCurrentActiveTabId()
    await tabs.sendMessage(currentTabId ?? 0, {
      type: 'PAYMENT_SUCCESS',
      data: { receiveAmount, incomingPayment, paymentPointer },
    })
    // console.log('outgoingPayment', outgoingPayment)
  }

  async confirmPayment() {
    const currentTabId = await this.getCurrentActiveTabId()

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

  async rotateToken() {
    const response = await this.axiosInstance.post(
      this.manageUrl,
      undefined,
      this.getHeaders(this.continuationRequestToken),
    )

    if (!response.data.access_token.value) {
      throw new Error('No continuation request')
    }

    this.manageUrl = response.data.access_token.manage
    this.continuationRequestToken = response.data.access_token.value
  }

  async sendPayment() {
    await this.createQuote()
    await this.runPayment()
  }

  async getCurrentActiveTabId() {
    const activeTabs = await tabs.query({ active: true, currentWindow: true })
    return activeTabs[0].id
  }
}
