import { type AuthenticatedClient } from '@interledger/open-payments/dist/client'
import { type WalletAddress, isFinalizedGrant } from '@interledger/open-payments/dist/types'
import { tabs } from 'webextension-polyfill'

export class PaymentFlowService {
  client: AuthenticatedClient
  sendingWalletAddress: WalletAddress
  receivingWalletAddress: WalletAddress
  sendingPaymentPointerUrl: string
  receivingPaymentPointerUrl: string
  incomingPaymentUrlId: string
  quoteUrlId: string
  token: string
  manageUrl: string
  amount: string | number
  clientNonce: string | null

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

    await this.createOpenPaymentsClient()

    await this.createIncomingPayment()

    const currentTabId = await this.getCurrentActiveTabId()
    await tabs.sendMessage(currentTabId ?? 0, { type: 'START_PAYMENTS' })
  }
}
