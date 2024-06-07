import { OpenPaymentsService } from './openPayments'
import {
  IncomingPayment,
  OutgoingPayment,
  Quote,
  WalletAddress,
  isPendingGrant
} from '@interledger/open-payments/dist/types'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client'
import { sendMonetizationEvent } from '../lib/messages'
import { convert, sleep } from '@/shared/helpers'

const DEFAULT_INTERVAL_MS = 1000
const HOUR_MS = 3600 * 1000
const MIN_SEND_AMOUNT = 1n // 1 unit

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
    private openPaymentsService: OpenPaymentsService
  ) {
    this.adjustSessionAmount()
  }

  // Only tested for same-currency transactions (USD mostly).
  // What to do for cross-currency? Will the sending part lose money (ASE),
  // when performing FX, since the receive amount will be ceiled?
  adjustSessionAmount(rate?: string): void {
    if (this.sender.assetCode !== this.receiver.assetCode) {
      throw new Error(
        `NOT IMPLEMENTED\nCross-currency transactions not supported`
      )
    }

    // TODO: When we will batch all the wallet addresses that are found in the page,
    // this is not going to be the rate, but `RATE_OF_PAY / No. of WA` (which
    // should be passed directly to the PaymentSession class when initializing it).
    if (rate) this.rate = rate

    const senderAssetScale = this.sender.assetScale
    const receiverAssetScale = this.receiver.assetScale

    // GitHub issue: https://github.com/interledger/rafiki/issues/2747
    // We would be able to test this in about 2 weeks (next Rafiki release)
    // and we will have to wait for the Test Wallet to use the latest version.
    //
    // Current implementation should work for this scenario as well.
    if (senderAssetScale < receiverAssetScale) {
      throw new Error(
        `NOT IMPLEMENTED\nSender asset scale is less than receiver asset scale.`
      )
    }

    // The amount that needs to be sent every second.
    // In senders asset scale already.
    const amountToSend = BigInt(this.rate) / 3600n

    if (amountToSend <= MIN_SEND_AMOUNT) {
      // We need to add another unit when using a debit amount, since
      // @interledger/pay substracts one unit.
      if (senderAssetScale <= receiverAssetScale) {
        this.setAmount(MIN_SEND_AMOUNT + 1n)
        return
      }

      // If the sender scale is greater than the receiver scale, the unit issue
      // will not be present.
      if (senderAssetScale > receiverAssetScale) {
        this.setAmount(MIN_SEND_AMOUNT)
        return
      }
    }

    // If the sender can facilitate the rate, but the amount can not be
    // represented in the receiver's scale we need to send the minimum amount
    // for the receiver (1 unit, but in the sender's asset scale)
    if (senderAssetScale > receiverAssetScale) {
      const amountInReceiversScale = convert(
        amountToSend,
        senderAssetScale,
        receiverAssetScale
      )

      if (amountInReceiversScale === 0n) {
        const amount = convert(
          MIN_SEND_AMOUNT,
          receiverAssetScale,
          senderAssetScale
        )
        this.setAmount(amount)
        return
      }
    }

    this.amount = amountToSend.toString()
    this.intervalInMs = DEFAULT_INTERVAL_MS
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

    await this.setIncomingPaymentUrl()

    let quote: Quote | undefined
    let outgoingPayment: OutgoingPayment | undefined

    while (this.active) {
      try {
        // Quote can be removed once the Test Wallet upgrades to alpha-10.
        // We will be able to create an outgoing payment with an incoming payment,
        // making the quoting unnecessary through OP.
        //
        // Note: Under the hood, Rafiki is still quoting.
        if (!quote) {
          quote = await this.openPaymentsService.createQuote({
            walletAddress: this.sender,
            receiver: this.incomingPaymentUrl,
            amount: this.amount
          })
        }

        outgoingPayment = await this.openPaymentsService.createOutgoingPayment({
          walletAddress: this.sender,
          quoteId: quote.id
        })
      } catch (e) {
        if (e instanceof OpenPaymentsClientError) {
          // Status code 403 -> expired access token
          if (e.status === 403) {
            await this.openPaymentsService.rotateToken()
            continue
          }

          // Is there a better way to handle this - expired incoming
          // payment?
          if (e.status === 400 && quote === undefined) {
            await this.setIncomingPaymentUrl()
            continue
          }

          // TODO: Check what Rafiki returns when there is no amount
          // left in the grant.
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

          await sleep(this.intervalInMs)
        }
      }
    }
  }

  private async setIncomingPaymentUrl() {
    if (this.incomingPaymentUrl) return

    const incomingPayment = await this.createIncomingPayment()
    this.incomingPaymentUrl = incomingPayment.id
  }

  private async createIncomingPayment(): Promise<IncomingPayment> {
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

    let quote: Quote | undefined
    let outgoingPayment: OutgoingPayment | undefined

    try {
      if (!quote) {
        quote = await this.openPaymentsService.createQuote({
          walletAddress: this.sender,
          receiver: incomingPayment.id,
          amount: (amount * 10 ** this.sender.assetScale).toFixed(0)
        })
      }

      outgoingPayment = await this.openPaymentsService.createOutgoingPayment({
        walletAddress: this.sender,
        quoteId: quote.id
      })
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
          await this.openPaymentsService.rotateToken()
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

  private setAmount(amount: bigint): void {
    this.amount = amount.toString()
    this.intervalInMs = Number((amount * BigInt(HOUR_MS)) / BigInt(this.rate))
  }
}
