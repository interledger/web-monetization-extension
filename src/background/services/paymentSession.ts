import {
  isPendingGrant,
  type IncomingPayment,
  type OutgoingPayment,
  type WalletAddress
} from '@interledger/open-payments/dist/types'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client'
import { sendMonetizationEvent } from '../lib/messages'
import { bigIntMax, convert, sleep } from '@/shared/helpers'
import { transformBalance } from '@/popup/lib/utils'
import {
  isInvalidReceiverError,
  isKeyRevokedError,
  isNonPositiveAmountError,
  isOutOfBalanceError,
  isTokenExpiredError
} from './openPayments'
import { getNextSendableAmount } from '@/background/utils'
import type { EventsService, OpenPaymentsService, TabState } from '.'
import type { MonetizationEventDetails } from '@/shared/messages'
import type { AmountValue } from '@/shared/types'

const DEFAULT_INTERVAL_MS = 1000
const HOUR_MS = 3600 * 1000
const MIN_SEND_AMOUNT = 1n // 1 unit

export class PaymentSession {
  private rate: string
  private active: boolean = false
  private isDisabled: boolean = false
  private incomingPaymentUrl: string
  private incomingPaymentExpiresAt: number
  private amount: string
  private intervalInMs: number
  private probing: number

  constructor(
    private receiver: WalletAddress,
    private sender: WalletAddress,
    private requestId: string,
    private tabId: number,
    private frameId: number,
    private openPaymentsService: OpenPaymentsService,
    private events: EventsService,
    private tabState: TabState,
    private url: string
  ) {}

  async adjustAmount(rate: AmountValue): Promise<void> {
    this.probing = Date.now()
    const probing = this.probing
    this.rate = rate

    // The amount that needs to be sent every second.
    // In senders asset scale already.
    const amountToSend = BigInt(this.rate) / 3600n
    const senderAssetScale = this.sender.assetScale
    const receiverAssetScale = this.receiver.assetScale

    // This all will eventually get replaced by OpenPayments response update
    // that includes a min rate that we can directly use.
    if (this.sender.assetCode !== this.receiver.assetCode) {
      await this.setIncomingPaymentUrl()
      for (const amount of getNextSendableAmount(
        senderAssetScale,
        receiverAssetScale,
        bigIntMax(amountToSend, MIN_SEND_AMOUNT)
      )) {
        if (this.probing !== probing) {
          throw new Error('Aborting')
        }
        try {
          await this.openPaymentsService.probeDebitAmount(
            amount,
            this.incomingPaymentUrl,
            this.sender
          )
          this.setAmount(BigInt(amount))
          return
        } catch (e) {
          if (isTokenExpiredError(e)) {
            await this.openPaymentsService.rotateToken()
          } else if (isNonPositiveAmountError(e)) {
            continue
          } else {
            throw e
          }
        }
      }
      return
    }

    if (amountToSend <= MIN_SEND_AMOUNT) {
      // We need to add another unit when using a debit amount, since
      // @interledger/pay subtracts one unit.
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
    this.probing = 0
  }

  get disabled() {
    return this.isDisabled
  }

  disable() {
    this.isDisabled = true
    this.stop()
  }

  /**
   * there's no enable() as we replace the sessions with new ones when
   * resume/start or removal of disabled attribute at the moment.
   * @deprecated
   */
  enable() {
    throw new Error('Method not implemented.')
  }

  stop() {
    this.active = false
  }

  resume() {
    this.start()
  }

  async start() {
    if (this.active || this.isDisabled) return
    this.active = true

    await this.setIncomingPaymentUrl()

    let outgoingPayment: OutgoingPayment | undefined

    const { waitTime, monetizationEvent } = this.tabState.getOverpayingDetails(
      this.tabId,
      this.url,
      this.receiver.id
    )

    if (monetizationEvent) {
      sendMonetizationEvent({
        tabId: this.tabId,
        frameId: this.frameId,
        payload: {
          requestId: this.requestId,
          details: monetizationEvent
        }
      })
    }

    await sleep(waitTime)

    while (this.active) {
      try {
        outgoingPayment = await this.openPaymentsService.createOutgoingPayment({
          walletAddress: this.sender,
          incomingPaymentId: this.incomingPaymentUrl,
          amount: this.amount
        })
      } catch (e) {
        if (isKeyRevokedError(e)) {
          this.events.emit('open_payments.key_revoked')
        } else if (isTokenExpiredError(e)) {
          await this.openPaymentsService.rotateToken()
          continue
        } else if (isOutOfBalanceError(e)) {
          const switched = await this.openPaymentsService.switchGrant()
          if (switched === null) {
            this.events.emit('open_payments.out_of_funds')
          }
        } else if (isInvalidReceiverError(e)) {
          if (Date.now() >= this.incomingPaymentExpiresAt) {
            await this.setIncomingPaymentUrl(true)
          }
          continue
        } else {
          throw e
        }
      } finally {
        if (outgoingPayment) {
          const { receiveAmount, receiver: incomingPayment } = outgoingPayment

          outgoingPayment = undefined

          const monetizationEventDetails: MonetizationEventDetails = {
            amountSent: {
              currency: receiveAmount.assetCode,
              value: transformBalance(
                receiveAmount.value,
                receiveAmount.assetScale
              )
            },
            incomingPayment,
            paymentPointer: this.receiver.id
          }

          sendMonetizationEvent({
            tabId: this.tabId,
            frameId: this.frameId,
            payload: {
              requestId: this.requestId,
              details: monetizationEventDetails
            }
          })

          // TO DO: find a better source of truth for deciding if overpaying is applicable
          if (this.intervalInMs > 1000) {
            this.tabState.saveOverpaying(this.tabId, this.url, {
              walletAddressId: this.receiver.id,
              monetizationEvent: monetizationEventDetails,
              intervalInMs: this.intervalInMs
            })
          }

          await sleep(this.intervalInMs)
        }
      }
    }
  }

  private async setIncomingPaymentUrl(reset?: boolean) {
    if (this.incomingPaymentUrl && !reset) return

    try {
      const incomingPayment = await this.createIncomingPayment()
      this.incomingPaymentUrl = incomingPayment.id
    } catch (error) {
      if (isKeyRevokedError(error)) {
        this.events.emit('open_payments.key_revoked')
        return
      }
      throw error
    }
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
          expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
          metadata: {
            source: 'Web Monetization'
          }
        }
      )

    if (incomingPayment.expiresAt) {
      this.incomingPaymentExpiresAt = new Date(
        incomingPayment.expiresAt
      ).valueOf()
    }

    // Revoke grant to avoid leaving users with unused, dangling grants.
    await this.openPaymentsService.client!.grant.cancel({
      url: incomingPaymentGrant.continue.uri,
      accessToken: incomingPaymentGrant.continue.access_token.value
    })

    return incomingPayment
  }

  async pay(amount: number) {
    if (this.isDisabled) return

    const incomingPayment = await this.createIncomingPayment().catch(
      (error) => {
        if (isKeyRevokedError(error)) {
          this.events.emit('open_payments.key_revoked')
          return
        }
        throw error
      }
    )
    if (!incomingPayment) return

    let outgoingPayment: OutgoingPayment | undefined

    try {
      outgoingPayment = await this.openPaymentsService.createOutgoingPayment({
        walletAddress: this.sender,
        incomingPaymentId: incomingPayment.id,
        amount: (amount * 10 ** this.sender.assetScale).toFixed(0)
      })
    } catch (e) {
      if (isKeyRevokedError(e)) {
        this.events.emit('open_payments.key_revoked')
      } else if (isTokenExpiredError(e)) {
        await this.openPaymentsService.rotateToken()
      } else {
        throw e
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
              amountSent: {
                currency: receiveAmount.assetCode,
                value: transformBalance(
                  receiveAmount.value,
                  receiveAmount.assetScale
                )
              },
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
