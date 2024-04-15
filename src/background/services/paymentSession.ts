import { OpenPaymentsService } from './openPayments'
import {
  OutgoingPayment,
  Quote,
  WalletAddress,
  isPendingGrant
} from '@interledger/open-payments/dist/types'
import { StorageService } from './storage'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client'
import { sendMonetizationEvent } from '../lib/messages'
import { sleep } from '@/shared/helpers'

export class PaymentSession {
  private active: boolean = false
  private incomingPaymentUrl: string

  constructor(
    private walletAddress: WalletAddress,
    private requestId: string,
    private tabId: number,
    private frameId: number,
    private rate: string,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService
  ) {}

  async stop() {
    this.active = false
  }

  async start() {
    this.active = true

    const { token, walletAddress } = await this.storage.get([
      'token',
      'walletAddress'
    ])

    if (token == null || walletAddress == null) {
      return
    }

    await this.createIncomingPayment()

    while (this.active) {
      let quote: Quote | undefined
      let outgoingPayment: OutgoingPayment | undefined

      try {
        if (!quote) {
          quote = await this.openPaymentsService.client!.quote.create(
            {
              url: walletAddress.resourceServer,
              accessToken: token.value
            },
            {
              method: 'ilp',
              receiver: this.incomingPaymentUrl,
              walletAddress: walletAddress.id,
              debitAmount: {
                // TODO: Update with the correct amount - hardcoded to get rid of errors
                value: '1000000',
                assetScale: 9,
                assetCode: 'USD'
              }
            }
          )
        }
        outgoingPayment =
          await this.openPaymentsService.client!.outgoingPayment.create(
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
      } catch (e) {
        /**
         * Unhandled exceptions:
         *  - Expired incoming payment: if the incoming payment is expired when
         *    trying to create a quote, create a new incoming payment
         *
         */
        if (e instanceof OpenPaymentsClientError) {
          // Status code 403 -> expired access token
          if (e.status === 403) {
            const rotatedToken =
              await this.openPaymentsService.client!.token.rotate({
                accessToken: token.value,
                url: token.manage
              })

            await this.storage.set({
              token: {
                value: rotatedToken.access_token.value,
                manage: rotatedToken.access_token.manage
              }
            })

            continue
          }

          throw new Error(e.message)
        }
      } finally {
        if (outgoingPayment) {
          const { receiveAmount, receiver: incomingPayment } = outgoingPayment

          quote = undefined
          outgoingPayment = undefined

          sendMonetizationEvent({
            tabId: this.tabId,
            frameId: this.frameId,
            payload: {
              requestId: this.requestId,
              details: {
                receiveAmount,
                incomingPayment,
                paymentPointer: this.walletAddress.id
              }
            }
          })

          // TODO: This is only the default wait time
          sleep(1000)
        }
      }
    }
  }

  async createIncomingPayment() {
    const incomingPaymentGrant =
      await this.openPaymentsService.client!.grant.request(
        {
          url: this.walletAddress.authServer
        },
        {
          access_token: {
            access: [
              {
                type: 'incoming-payment',
                actions: ['create', 'read', 'list'],
                identifier: this.walletAddress.id
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
          url: this.walletAddress.resourceServer,
          accessToken: incomingPaymentGrant.access_token.value
        },
        {
          walletAddress: this.walletAddress.id,
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

    this.incomingPaymentUrl = incomingPayment.id
  }
}
