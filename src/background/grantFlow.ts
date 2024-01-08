import { tabs } from 'webextension-polyfill'

import { WM_WALLET_ADDRESS } from '@/background/config'
import {
  createQuote,
  getHeaders,
  getIncomingPaymentGrant,
  getIncomingPaymentUrlId,
  getOutgoingPaymentGrant,
  getQuoteGrant,
} from '@/background/grant'
import { confirmPayment } from '@/background/grant/confirmPayment'
import { getContinuationRequest } from '@/background/grant/getContinuationRequest'
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

    this.clientAuthToken = await getIncomingPaymentGrant({
      client: WM_WALLET_ADDRESS,
      identifier: this.receivingPaymentPointerUrl,
      wallet: this.receivingWalletAddress,
      instance: this.axiosInstance,
    })

    this.incomingPaymentUrlId = await getIncomingPaymentUrlId({
      walletAddress: this.receivingPaymentPointerUrl,
      token: this.clientAuthToken,
      instance: this.axiosInstance,
    })

    this.quoteGrantToken = await getQuoteGrant({
      client: WM_WALLET_ADDRESS,
      identifier: this.sendingPaymentPointerUrl,
      wallet: this.sendingWalletAddress,
      instance: this.axiosInstance,
    })

    const outgoingData = await getOutgoingPaymentGrant({
      client: WM_WALLET_ADDRESS,
      identifier: this.sendingPaymentPointerUrl,
      wallet: this.sendingWalletAddress,
      amount: this.amount,
      instance: this.axiosInstance,
    })

    this.outgoingPaymentGrantToken = outgoingData.outgoingPaymentGrantToken
    this.outgoingPaymentGrantData = outgoingData.outgoingPaymentGrantData

    this.interactRef = await confirmPayment(this.outgoingPaymentGrantData.interact.redirect)

    const continuationRequest = await getContinuationRequest({
      url: this.outgoingPaymentGrantData.continue.uri,
      interactRef: this.interactRef,
      token: this.outgoingPaymentGrantToken,
      instance: this.axiosInstance,
    })

    this.manageUrl = continuationRequest.manageUrl
    this.continuationRequestToken = continuationRequest.continuationRequestToken

    const currentTabId = await this.getCurrentActiveTabId()
    await tabs.sendMessage(currentTabId ?? 0, { type: 'START_PAYMENTS' })
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

  async runPayment() {
    const payload = {
      walletAddress: this.sendingPaymentPointerUrl,
      quoteId: this.quoteUrlId,
    }

    const response = await this.axiosInstance.post(
      new URL(this.sendingPaymentPointerUrl).origin + '/outgoing-payments',
      payload,
      getHeaders(this.continuationRequestToken),
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

  async sendPayment() {
    this.quoteUrlId = await createQuote({
      receiver: this.incomingPaymentUrlId,
      walletAddress: this.sendingWalletAddress,
      sendingUrl: this.sendingPaymentPointerUrl,
      token: this.quoteGrantToken,
      amount: '1000000',
      instance: this.axiosInstance,
    })

    await this.runPayment()
  }

  async getCurrentActiveTabId() {
    const activeTabs = await tabs.query({ active: true, currentWindow: true })
    return activeTabs[0].id
  }
}
