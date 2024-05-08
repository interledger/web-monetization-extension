import { OpenPaymentsService } from './openPayments'
import {
  IncomingPayment,
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

    let token = data.token
    const walletAddress = data.walletAddress

    if (token == null || walletAddress == null) {
      return
    }

    await this.setIncomingPaymentUrl()

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
                value: this.amount,
                assetScale: walletAddress.assetScale,
                assetCode: walletAddress.assetCode
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

            token = {
              value: rotatedToken.access_token.value,
              manage: rotatedToken.access_token.manage
            }

            void this.storage.set({
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
                paymentPointer: this.receiver.id
              }
            }
          })

          // TODO: This is only the default wait time
          await sleep(1000)
        }
      }
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

  // TODO: Needs refactoring - breaks DRY
  async pay(amount: number) {
    const incomingPayment = await this.createIncomingPayment()
    const data = await this.storage.get(['token', 'walletAddress'])

    let token = data.token
    const walletAddress = data.walletAddress

    if (token == null || walletAddress == null) {
      return
    }

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
            receiver: incomingPayment.id,
            walletAddress: walletAddress.id,
            debitAmount: {
              value: (amount * 10 ** walletAddress.assetScale).toFixed(0),
              assetScale: walletAddress.assetScale,
              assetCode: walletAddress.assetCode
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

          token = {
            value: rotatedToken.access_token.value,
            manage: rotatedToken.access_token.manage
          }

          void this.storage.set({
            token: {
              value: rotatedToken.access_token.value,
              manage: rotatedToken.access_token.manage
            }
          })
        }

      }
    } finally {
      if (outgoingPayment) {
        const { receiveAmount, receiver: incomingPayment } = outgoingPayment

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
      }
    }

    return outgoingPayment?.debitAmount
  }
}
