import {
  isPendingGrant,
  type IncomingPayment,
  type OutgoingPayment,
  type WalletAddress
} from '@interledger/open-payments/dist/types'
import { sendMonetizationEvent } from '../lib/messages'
import { bigIntMax, convert } from '@/shared/helpers'
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
import type { Logger } from '@/shared/logger'

const HOUR_MS = 3600 * 1000
const MIN_SEND_AMOUNT = 1n // 1 unit
const MAX_INVALID_RECEIVER_ATTEMPTS = 2

type PaymentSessionSource = 'tab-change' | 'request-id-reused' | 'new-link'
type IncomingPaymentSource = 'one-time' | 'continuous'

export class PaymentSession {
  private rate: string
  private active: boolean = false
  /** Invalid receiver (providers not peered or other reasons) */
  private isInvalid: boolean = false
  private countInvalidReceiver: number = 0
  private isDisabled: boolean = false
  private incomingPaymentUrl: string
  private incomingPaymentExpiresAt: number
  private amount: string
  private intervalInMs: number
  private probingId: number
  private shouldRetryImmediately: boolean = false

  private interval: ReturnType<typeof setInterval> | null = null
  private timeout: ReturnType<typeof setTimeout> | null = null

  constructor(
    private receiver: WalletAddress,
    private sender: WalletAddress,
    private requestId: string,
    private tabId: number,
    private frameId: number,
    private openPaymentsService: OpenPaymentsService,
    private events: EventsService,
    private tabState: TabState,
    private url: string,
    private logger: Logger
  ) {}

  async adjustAmount(rate: AmountValue): Promise<void> {
    this.probingId = Date.now()
    const localProbingId = this.probingId
    this.rate = rate

    // The amount that needs to be sent every second.
    // In senders asset scale already.
    let amountToSend = BigInt(this.rate) / 3600n
    const senderAssetScale = this.sender.assetScale
    const receiverAssetScale = this.receiver.assetScale
    const isCrossCurrency = this.sender.assetCode !== this.receiver.assetCode

    if (!isCrossCurrency) {
      if (amountToSend <= MIN_SEND_AMOUNT) {
        // We need to add another unit when using a debit amount, since
        // @interledger/pay subtracts one unit.
        if (senderAssetScale <= receiverAssetScale) {
          amountToSend = MIN_SEND_AMOUNT + 1n
        } else if (senderAssetScale > receiverAssetScale) {
          // If the sender scale is greater than the receiver scale, the unit
          // issue will not be present.
          amountToSend = MIN_SEND_AMOUNT
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
          amountToSend = convert(
            MIN_SEND_AMOUNT,
            receiverAssetScale,
            senderAssetScale
          )
        }
      }
    }

    // This all will eventually get replaced by OpenPayments response update
    // that includes a min rate that we can directly use.
    await this.setIncomingPaymentUrl()
    const amountIter = getNextSendableAmount(
      senderAssetScale,
      receiverAssetScale,
      bigIntMax(amountToSend, MIN_SEND_AMOUNT)
    )

    amountToSend = BigInt(amountIter.next().value)
    while (true) {
      if (this.probingId !== localProbingId) {
        // In future we can throw `new AbortError()`
        throw new DOMException('Aborting existing probing', 'AbortError')
      }
      try {
        await this.openPaymentsService.probeDebitAmount(
          amountToSend.toString(),
          this.incomingPaymentUrl,
          this.sender
        )
        this.setAmount(amountToSend)
        break
      } catch (e) {
        if (isTokenExpiredError(e)) {
          await this.openPaymentsService.rotateToken()
        } else if (isNonPositiveAmountError(e)) {
          amountToSend = BigInt(amountIter.next().value)
          continue
        } else if (isInvalidReceiverError(e)) {
          this.markInvalid()
          this.events.emit('open_payments.invalid_receiver', {
            tabId: this.tabId
          })
          break
        } else {
          throw e
        }
      }
    }
  }

  get id() {
    return this.requestId
  }

  get disabled() {
    return this.isDisabled
  }

  get invalid() {
    return this.isInvalid
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

  private markInvalid() {
    this.isInvalid = true
    this.stop()
  }

  stop() {
    this.active = false
    this.clearTimers()
  }

  resume() {
    this.start('tab-change')
  }

  private clearTimers() {
    if (this.interval) {
      this.debug(`Clearing interval=${this.timeout}`)
      clearInterval(this.interval)
      this.interval = null
    }
    if (this.timeout) {
      this.debug(`Clearing timeout=${this.timeout}`)
      clearTimeout(this.timeout)
      this.timeout = null
    }
  }

  private debug(message: string) {
    this.logger.debug(
      `[PAYMENT SESSION] requestId=${this.requestId}; receiver=${this.receiver.id}\n\n`,
      `   ${message}`
    )
  }

  async start(source: PaymentSessionSource) {
    this.debug(
      `Attempting to start; source=${source} active=${this.active} disabled=${this.isDisabled} isInvalid=${this.isInvalid}`
    )
    if (this.active || this.isDisabled || this.isInvalid) return
    this.debug(`Session started; source=${source}`)
    this.active = true

    await this.setIncomingPaymentUrl()

    const { waitTime, monetizationEvent } = this.tabState.getOverpayingDetails(
      this.tabId,
      this.url,
      this.receiver.id
    )

    this.debug(`Overpaying: waitTime=${waitTime}`)

    if (monetizationEvent && source !== 'tab-change') {
      sendMonetizationEvent({
        tabId: this.tabId,
        frameId: this.frameId,
        payload: {
          requestId: this.requestId,
          details: monetizationEvent
        }
      })
    }

    // Uncomment this after we perform the Rafiki test and remove the leftover
    // code below.
    //
    // if (this.canContinuePayment) {
    //   this.timeout = setTimeout(() => {
    //     void this.payContinuous()
    //
    //     this.interval = setInterval(() => {
    //       if (!this.canContinuePayment) {
    //           this.clearTimers()
    //           return
    //       }
    //       void this.payContinuous()
    //     }, this.intervalInMs)
    //   }, waitTime)
    // }

    // Leftover
    const continuePayment = () => {
      if (!this.canContinuePayment) return
      // alternatively (leftover) after we perform the Rafiki test, we can just
      // skip the `.then()` here and call setTimeout recursively immediately
      void this.payContinuous().then(() => {
        this.timeout = setTimeout(
          () => {
            continuePayment()
          },
          this.shouldRetryImmediately ? 0 : this.intervalInMs
        )
      })
    }

    if (this.canContinuePayment) {
      this.timeout = setTimeout(async () => {
        await this.payContinuous()
        this.timeout = setTimeout(
          () => {
            continuePayment()
          },
          this.shouldRetryImmediately ? 0 : this.intervalInMs
        )
      }, waitTime)
    }
  }

  private get canContinuePayment() {
    return this.active && !this.isDisabled && !this.isInvalid
  }

  private async setIncomingPaymentUrl(reset?: boolean) {
    if (this.incomingPaymentUrl && !reset) return

    try {
      const incomingPayment = await this.createIncomingPayment('continuous')
      this.incomingPaymentUrl = incomingPayment.id
    } catch (error) {
      if (isKeyRevokedError(error)) {
        this.events.emit('open_payments.key_revoked')
        return
      }
      throw error
    }
  }

  private async createIncomingPayment(
    source: IncomingPaymentSource
  ): Promise<IncomingPayment> {
    const expiresAt = new Date(
      Date.now() + 1000 * (source === 'continuous' ? 60 * 10 : 30)
    ).toISOString()

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
          expiresAt,
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
    if (this.isDisabled) {
      throw new Error('Attempted to send a payment to a disabled session.')
    }

    const incomingPayment = await this.createIncomingPayment('one-time').catch(
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

  private async payContinuous() {
    try {
      const outgoingPayment =
        await this.openPaymentsService.createOutgoingPayment({
          walletAddress: this.sender,
          incomingPaymentId: this.incomingPaymentUrl,
          amount: this.amount
        })
      const { receiveAmount, receiver: incomingPayment } = outgoingPayment
      const monetizationEventDetails: MonetizationEventDetails = {
        amountSent: {
          currency: receiveAmount.assetCode,
          value: transformBalance(receiveAmount.value, receiveAmount.assetScale)
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
      this.shouldRetryImmediately = false
    } catch (e) {
      if (isKeyRevokedError(e)) {
        this.events.emit('open_payments.key_revoked')
      } else if (isTokenExpiredError(e)) {
        await this.openPaymentsService.rotateToken()
        this.shouldRetryImmediately = true
      } else if (isOutOfBalanceError(e)) {
        const switched = await this.openPaymentsService.switchGrant()
        if (switched === null) {
          this.events.emit('open_payments.out_of_funds')
        } else {
          this.shouldRetryImmediately = true
        }
      } else if (isInvalidReceiverError(e)) {
        if (Date.now() >= this.incomingPaymentExpiresAt) {
          await this.setIncomingPaymentUrl(true)
          this.shouldRetryImmediately = true
        } else {
          ++this.countInvalidReceiver
          if (
            this.countInvalidReceiver >= MAX_INVALID_RECEIVER_ATTEMPTS &&
            !this.isInvalid
          ) {
            this.markInvalid()
            this.events.emit('open_payments.invalid_receiver', {
              tabId: this.tabId
            })
          } else {
            this.shouldRetryImmediately = true
          }
        }
      } else {
        throw e
      }
    }
  }
}
