// TO DO
import { isPendingGrant } from '@interledger/open-payments/dist/types'
import { OpenPaymentsService } from './openPayments'
import { type Browser } from 'webextension-polyfill'

export class MonetizationService {
  constructor(
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
  ) {}

  private async createIncomingPayment() {
    const incomingPaymentGrant = await this.openPaymentsService.client!.grant.request(
      {
        url: this.receivingWalletAddress.authServer
      },
      {
        access_token: {
          access: [
            {
              type: 'incoming-payment',
              actions: ['create', 'read', 'list'],
              identifier: this.receivingWalletAddress.id
            }
          ]
        }
      }
    )

    if (isPendingGrant(incomingPaymentGrant)) {
      throw new Error('Expected non-interactive grant. Received pending grant.')
    }

    const incomingPayment = await this.openPaymentsService.client!.incomingPayment.create(
      {
        url: this.receivingWalletAddress.resourceServer,
        accessToken: incomingPaymentGrant.access_token.value
      },
      {
        walletAddress: this.receivingWalletAddress.id,
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

    this.incomingPaymentUrlId = incomingPayment.id
  }

  async sendPayment() {
    // (1) TODO: Use the amount that is derived from the rate of pay

    // Notice: The same access token is used for both quotes and outgoing payments.
    // During the grant request process, it is possible to specify multiple accesses.
    // Employing a singular access token simplifies the process by eliminating the need to manage two separate access tokens for the sending side.
    const AMOUNT = 0.02

    let quote: Quote | undefined
    let outgoingPayment: OutgoingPayment | undefined

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        if (!quote) {
          quote = await this.client.quote.create(
            {
              url: this.sendingWalletAddress.resourceServer,
              accessToken: this.token
            },
            {
              method: 'ilp',
              receiver: this.incomingPaymentUrlId,
              walletAddress: this.sendingWalletAddress.id,
              debitAmount: {
                value: String(
                  AMOUNT * 10 ** this.sendingWalletAddress.assetScale
                ),
                assetScale: this.sendingWalletAddress.assetScale,
                assetCode: this.sendingWalletAddress.assetCode
              }
            }
          )
        }
        outgoingPayment = await this.client.outgoingPayment.create(
          {
            url: this.sendingWalletAddress.resourceServer,
            accessToken: this.token
          },
          {
            walletAddress: this.sendingWalletAddress.id,
            quoteId: quote.id,
            metadata: {
              source: 'Web Monetization'
            }
          }
        )
        break
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
            const rotatedToken = await this.client.token.rotate({
              accessToken: this.token,
              url: this.manageUrl
            })

            this.token = rotatedToken.access_token.value
            this.manageUrl = rotatedToken.access_token.manage
            continue
          }

          throw new Error(e.message)
        }
      } finally {
        if (outgoingPayment) {
          const {
            receiveAmount,
            receiver: incomingPayment,
            walletAddress: paymentPointer
          } = outgoingPayment

          const activeTabs = await this.browser.tabs.query({ active: true, currentWindow: true })

          const currentTabId = activeTabs[0].id
          await this.browser.tabs.sendMessage(currentTabId ?? 0, {
            type: 'PAYMENT_SUCCESS',
            data: { receiveAmount, incomingPayment, paymentPointer }
          })
        }
      }
    }
  }
}
