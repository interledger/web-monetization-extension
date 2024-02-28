import {
  type AuthenticatedClient,
  OpenPaymentsClientError,
} from '@interledger/open-payments/dist/client'
import {
  type OutgoingPayment,
  type Quote,
  type WalletAddress,
  isFinalizedGrant,
  isPendingGrant,
} from '@interledger/open-payments/dist/types'
import { tabs } from 'webextension-polyfill'

interface InteractionParams {
  interactRef: string
  hash: string
}

interface VerifyInteractionHashParams {
  clientNonce: string
  interactRef: string
  interactNonce: string
  hash: string
}

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
    const clientNonce = crypto.randomUUID()
    const grant = await this.createQuoteAndOutgoingPaymentGrant(clientNonce)
    // Q: Should this be moved to continuation polling?
    // https://github.com/interledger/open-payments/issues/385
    const { interactRef, hash } = await this.confirmPayment(grant.interact.redirect)
    await this.verifyInteractionHash({
      clientNonce,
      interactNonce: grant.interact.finish,
      interactRef,
      hash,
    })
    const continuation = await this.client.grant.continue(
      {
        url: grant.continue.uri,
        accessToken: grant.continue.access_token.value,
      },
      {
        interact_ref: interactRef,
      },
    )
    if (!isFinalizedGrant(continuation)) {
      throw new Error('Expected finalized grant. Received unfinalized grant.')
    }
    this.manageUrl = continuation.access_token.manage
    this.token = continuation.access_token.value
    const currentTabId = await this.getCurrentActiveTabId()
    await tabs.sendMessage(currentTabId ?? 0, { type: 'START_PAYMENTS' })
  }

  private async confirmPayment(url: string): Promise<InteractionParams> {
    const currentTabId = await this.getCurrentActiveTabId()

    return await new Promise(res => {
      if (url) {
        tabs.create({ url }).then(tab => {
          if (tab.id) {
            tabs.onUpdated.addListener((tabId, changeInfo) => {
              try {
                const tabUrl = new URL(changeInfo.url || '')
                const interactRef = tabUrl.searchParams.get('interact_ref')
                const hash = tabUrl.searchParams.get('hash')

                if (tabId === tab.id && interactRef && hash) {
                  tabs.update(currentTabId, { active: true })
                  tabs.remove(tab.id)
                  res({ interactRef, hash })
                }
              } catch (e) {
                /* do nothing */
              }
            })
          }
        })
      }
    })
  }
}
