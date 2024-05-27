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
import { DEFAULT_SCALE } from '../config'

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
        this.evaluateSessionAmount()
    }

    evaluateSessionAmount(): void {
        const senderAssetScale = this.sender.assetScale
        const receiverAssetScale = this.receiver.assetScale

        if (senderAssetScale < 2) {
            throw new Error(`NOT IMPLEMENTED\nAsset scale less than 2 not supported at the moment.`)
        }

        // This can work without any issues if we are sending between two Rafiki
        // nodes that are peered, since the `maxPacketAmount` can be adjusted.
        // When the sender and the receiver are on the same node, the
        // `maxPacketAmount` is equal to MAX_INT64 by default, which is causing
        // a database error when creating the quote, because it receives really
        // big numbers for the estimated exchange rates.
        //
        // TODO: Keep in touch with the Rafiki team and remove this check when
        // we can send from a low scale to a high scale. This might require
        // changes to the code below.
        if (senderAssetScale < receiverAssetScale) {
            throw new Error(`NOT IMPLEMENTED\nSender asset scale is less than receiver asset scale.`);
        }

        // The rate is already stored in the users scale
        const amountToSend = BigInt(this.rate) / BigInt(3600)

        // If amountToSend is 0, it means that the user wallet is not
        // able to send a payment every second to facilitate the rate of pay.
        // We need to use the minimum amount (1 unit) and adjust the interval.
        if (amountToSend === BigInt(0)) {
            if (senderAssetScale === receiverAssetScale) {
                this.setAmount(MIN_SEND_AMOUNT + BigInt(1), senderAssetScale)
                return
            }

            if (senderAssetScale > receiverAssetScale) {
                this.setAmount(MIN_SEND_AMOUNT, senderAssetScale)
                return
            }
        }

        // If amountToSend is 1, we can send from a high asset scale to a low asset
        // scale without running into the `debitAmount` issue, but not if the
        // scales are equal or the sending asset scale is less than the
        // receiving scale.
        if (amountToSend === BigInt(1)) {
            if (senderAssetScale === receiverAssetScale) {
                this.setAmount(MIN_SEND_AMOUNT + BigInt(1), senderAssetScale)
                return
            }
        }

        this.amount = amountToSend.toString()
        this.intervalInMs = DEFAULT_INTERVAL_IN_MS;
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

                    // Is there a better way to handle this - expired incoming
                    // payment?
                    if (e.status === 400 && quote === undefined) {
                        await this.setIncomingPaymentUrl()
                        continue;
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
        if (this.incomingPaymentUrl) return;

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

    private setAmount(amount: bigint, scale: number): void {
        this.amount = amount.toString()
        this.intervalInMs =
            Math.floor(Number(amount) * HOUR_IN_MS / Number(this.rate) * Math.pow(10, scale - DEFAULT_SCALE))
    }
}
