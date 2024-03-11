// TO DO
import {
  OutgoingPayment,
  Quote,
  WalletAddress,
  isPendingGrant
} from '@interledger/open-payments/dist/types'
import { OpenPaymentsService, StorageService } from '.'
import { type Browser } from 'webextension-polyfill'
import { OpenPaymentsClientError } from '@interledger/open-payments/dist/client'
import { Logger } from '@/shared/logger'

const getWalletAddress = (): WalletAddress => {
  // TO DO
  return {
    id: '',
    assetCode: '',
    assetScale: 1,
    authServer: '',
    resourceServer: ''
  }
}
export class MonetizationService {
  private incomingPaymentUrlId: string

  constructor(
    private logger: Logger,
    private browser: Browser,
    private openPaymentsService: OpenPaymentsService,
    private storage: StorageService
  ) {}

  async toggleWM() {
    const { enabled } = await this.storage.get(['enabled'])
    await this.storage.set({ enabled: !enabled })
  }

  async createIncomingPayment() {
    const walletAddress: WalletAddress = getWalletAddress()

    const incomingPaymentGrant =
      await this.openPaymentsService.client!.grant.request(
        {
          url: walletAddress.authServer
        },
        {
          access_token: {
            access: [
              {
                type: 'incoming-payment',
                actions: ['create', 'read', 'list'],
                identifier: walletAddress.id
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
          url: walletAddress.resourceServer,
          accessToken: incomingPaymentGrant.access_token.value
        },
        {
          walletAddress: walletAddress.id,
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
    const storage = await this.storage.get()
    if (
      !storage.walletAddress ||
      !storage.token?.value ||
      !storage.amount?.value
    )
      return
    // (1) TODO: Use the amount that is derived from the rate of pay

    // Notice: The same access token is used for both quotes and outgoing payments.
    // During the grant request process, it is possible to specify multiple accesses.
    // Employing a singular access token simplifies the process by eliminating the need to manage two separate access tokens for the sending side.

    let quote: Quote | undefined
    let outgoingPayment: OutgoingPayment | undefined

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        if (!quote) {
          quote = await this.openPaymentsService.client!.quote.create(
            {
              url: storage.walletAddress.resourceServer,
              accessToken: storage.token.value
            },
            {
              method: 'ilp',
              receiver: this.incomingPaymentUrlId,
              walletAddress: storage.walletAddress.id,
              debitAmount: {
                value: String(
                  storage.amount.value * 10 ** storage.walletAddress.assetScale
                ),
                assetScale: storage.walletAddress.assetScale,
                assetCode: storage.walletAddress.assetCode
              }
            }
          )
        }
        outgoingPayment =
          await this.openPaymentsService.client!.outgoingPayment.create(
            {
              url: storage.walletAddress.resourceServer,
              accessToken: storage.token.value
            },
            {
              walletAddress: storage.walletAddress.id,
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
            const rotatedToken =
              await this.openPaymentsService.client!.token.rotate({
                accessToken: storage.token.value,
                url: storage.token.manage
              })

            this.storage.set({
              token: {
                value: rotatedToken.access_token.value,
                manage: rotatedToken.access_token.manage
              }
            })

            // this.token = rotatedToken.access_token.value
            // this.manageUrl = rotatedToken.access_token.manage
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

          const activeTabs = await this.browser.tabs.query({
            active: true,
            currentWindow: true
          })

          // TO DO: is this needed?
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
