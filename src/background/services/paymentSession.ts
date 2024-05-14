import { OpenPaymentsService } from './openPayments'
import {
  type IncomingPayment,
  type WalletAddress,
  isPendingGrant
} from '@interledger/open-payments/dist/types'
import { StorageService } from './storage'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client'
import { sendMonetizationEvent } from '../lib/messages'
import { sleep } from '@/shared/helpers'
import type { Storage } from '@/shared/types'

export class PaymentSession {
  private active: boolean = false
  private incomingPaymentUrl: string
  private amount: string

  constructor(
    private receiver: WalletAddress,
    private requestId: string,
    private tabId: number,
    private frameId: number,
    private rate: string,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService
  ) {
    this.calculateDebitAmount()
  }

  private calculateDebitAmount() {
    // This is only follows the happy path (scale 9)
    this.amount = (Number(this.rate) / 3600).toFixed(0)
  }

  stop() {
    this.active = false
  }

  resume() {
    this.start()
  }

  async start() {
    if (this.active) return
    this.active = true

    const data = await this.storage.get(['token', 'walletAddress'])
    const { walletAddress } = data
    let { token } = data
    if (token == null || walletAddress == null) {
      return
    }

    await this.setIncomingPaymentUrl()

    while (this.active) {
      const res = await this.createOutgoingPayment({
        debitAmountValue: this.amount,
        token,
        walletAddress,
        receiver: this.incomingPaymentUrl
      })
      if (res.type === 'success') {
        const { receiveAmount, receiver: incomingPayment } = res.outgoingPayment
        sendMonetizationEvent({
          tabId: this.tabId,
          frameId: this.frameId,
          payload: {
            requestId: this.requestId,
            details: {
              receiveAmount,
              incomingPayment,
              paymentPointer: this.receiver.id
            }
          }
        })

        // TODO: This is only the default wait time
        await sleep(1000)
      } else if (res.type === 'failure' && res.token) {
        token = res.token
      }
    }
  }

  private async createOutgoingPayment(params: {
    debitAmountValue: string
    token: NonNullable<Storage['token']>
    walletAddress: NonNullable<Storage['walletAddress']>
    receiver: string
  }) {
    const { debitAmountValue, token, walletAddress, receiver } = params
    const client = this.openPaymentsService.client!
    try {
      const quote = await client.quote.create(
        {
          url: walletAddress.resourceServer,
          accessToken: token.value
        },
        {
          method: 'ilp',
          receiver: receiver,
          walletAddress: walletAddress.id,
          debitAmount: {
            value: debitAmountValue,
            assetScale: walletAddress.assetScale,
            assetCode: walletAddress.assetCode
          }
        }
      )
      const outgoingPayment = await client.outgoingPayment.create(
        {
          url: walletAddress.resourceServer,
          accessToken: token.value
        },
        {
          walletAddress: walletAddress.id,
          quoteId: quote.id,
          metadata: {
            source: 'Web Monetization'
          }
        }
      )
      return { type: 'success' as const, outgoingPayment }
    } catch (e) {
      /**
       * Unhandled exceptions:
       *  - Expired incoming payment: if the incoming payment is expired when
       *    trying to create a quote, create a new incoming payment
       *z`
       */
      if (e instanceof OpenPaymentsClientError) {
        // Status code 403 -> expired access token
        if (e.status === 403) {
          const rotatedToken =
            await this.openPaymentsService.client!.token.rotate({
              accessToken: token.value,
              url: token.manage
            })

          const newToken = {
            value: rotatedToken.access_token.value,
            manage: rotatedToken.access_token.manage
          }
          void this.storage.set({ token: newToken })

          return { type: 'failure' as const, token }
        }

        throw new Error(e.message)
      }
      return { type: 'failure' as const, error: e }
    }
  }

  async setIncomingPaymentUrl() {
    const incomingPayment = await this.createIncomingPayment()
    this.incomingPaymentUrl = incomingPayment.id
  }

  async createIncomingPayment(): Promise<IncomingPayment> {
    const incomingPaymentGrant =
      await this.openPaymentsService.client!.grant.request(
        {
          url: this.receiver.authServer
        },
        {
          access_token: {
            access: [
              {
                type: 'incoming-payment',
                actions: ['create'],
                identifier: this.receiver.id
              }
            ]
          }
        }
      )

    if (isPendingGrant(incomingPaymentGrant)) {
      throw new Error('Expected non-interactive grant. Received pending grant.')
    }

    const incomingPayment =
      await this.openPaymentsService.client!.incomingPayment.create(
        {
          url: this.receiver.resourceServer,
          accessToken: incomingPaymentGrant.access_token.value
        },
        {
          walletAddress: this.receiver.id,
          expiresAt: new Date(Date.now() + 6000 * 60 * 10).toISOString(),
          metadata: {
            source: 'Web Monetization'
          }
        }
      )

    // Revoke grant to avoid leaving users with unused, dangling grants.
    await this.openPaymentsService.client!.grant.cancel({
      url: incomingPaymentGrant.continue.uri,
      accessToken: incomingPaymentGrant.continue.access_token.value
    })

    return incomingPayment
  }

  async pay(amount: number) {
    const data = await this.storage.get(['token', 'walletAddress'])
    let token = data.token
    const walletAddress = data.walletAddress

    if (token == null || walletAddress == null) {
      return
    }

    const incomingPayment = await this.createIncomingPayment()
    const debitAmountValue = amount * 10 ** walletAddress.assetScale
    const res = await this.createOutgoingPayment({
      debitAmountValue: debitAmountValue.toFixed(0),
      token,
      walletAddress,
      receiver: incomingPayment.id
    })

    if (res.type === 'success' && res.outgoingPayment) {
      const { receiveAmount, receiver: incomingPayment } = res.outgoingPayment

      sendMonetizationEvent({
        tabId: this.tabId,
        frameId: this.frameId,
        payload: {
          requestId: this.requestId,
          details: {
            receiveAmount,
            incomingPayment,
            paymentPointer: this.receiver.id
          }
        }
      })

      return res.outgoingPayment.debitAmount
    } else if (res.type === 'failure' && res.token) {
      token = res.token
    }
  }
}
