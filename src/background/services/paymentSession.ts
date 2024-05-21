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

const DEFAULT_INTERVAL_IN_MS = 1000
const HOUR_IN_MS = 3600 * 1000
const MIN_SEND_AMOUNT = BigInt(1) // 1 unit

export class PaymentSession {
  private active: boolean = false
  private incomingPaymentUrl: string
  private amount: string
  private intervalInMs: number

  constructor(
    private receiver: WalletAddress,
    private sender: WalletAddress,
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
    const senderAssetScale = this.sender.assetScale
    const receiverAssetScale = this.receiver.assetScale

    // The rate is already stored in the users scale:
    //  - rate: 600000000 (scale 9) => $0.60
    const amountToSend = BigInt(this.rate) / BigInt(3600)
    if (amountToSend === BigInt(0)) {
      // If amountToSend = 0, it means that the user wallet is not
      // able to send a payment every second to facilitate the rate of pay
      // and we need to use the minimum amount (1 unit) and recalculate the interval..
      //
      // Eg:
      //   - scale: 2
      //   - rate: 60 ($0.60)
      //   - amount: 60n / 3600n = 0n => amountToSend = 1n (@interledger/pay)
      //   - interval: 2 minutes

      // We have to add 1n to the MIN_SEND_AMOUNT.
      // @interledger/pay substracts 1 unit when using a debit amount.
      // Can be removed once there is a solution for this in Rafiki/library.
      this.amount = (MIN_SEND_AMOUNT + BigInt(1)).toString() // adding +1 - cause: (@interledger/pay)
      this.intervalInMs =
        ((Number(MIN_SEND_AMOUNT + BigInt(1)) * HOUR_IN_MS) /
          Number(this.rate)) *
        Math.pow(10, senderAssetScale - receiverAssetScale)
      return
    }

    const amountInSendersScale = Number(amountToSend) * 10 ** -senderAssetScale
    const amountInReceiversScale = Number(amountInSendersScale.toFixed(2))

    if (amountInReceiversScale === 0) {
      this.amount = (
        Number(MIN_SEND_AMOUNT) *
        10 ** (senderAssetScale - receiverAssetScale)
      ).toString()
      this.intervalInMs =
        ((Number(MIN_SEND_AMOUNT + BigInt(1)) * HOUR_IN_MS) /
          Number(this.rate)) *
        Math.pow(10, senderAssetScale - receiverAssetScale)
    } else {
      this.amount = amountToSend.toString()
      this.intervalInMs = Number(DEFAULT_INTERVAL_IN_MS)
    }
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
          await sleep(this.intervalInMs)
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
