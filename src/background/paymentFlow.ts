import {
  type AuthenticatedClient,
  createAuthenticatedClient,
} from '@interledger/open-payments/dist/client'
import {
  isFinalizedGrant,
  isPendingGrant,
  WalletAddress,
} from '@interledger/open-payments/dist/types'
import * as ed from '@noble/ed25519'
import { type Request } from 'http-message-signatures'
import { signMessage } from 'http-message-signatures/lib/httpbis'
import { createContentDigestHeader } from 'httpbis-digest-headers'
import { tabs } from 'webextension-polyfill'

interface RequestLike extends Request {
  body?: string
}

interface SignOptions {
  request: RequestLike
  privateKey: Uint8Array
  keyId: string
}

export interface SignatureHeaders {
  Signature: string
  'Signature-Input': string
}

interface ContentHeaders {
  'Content-Digest': string
  'Content-Length': string
  'Content-Type': string
}

interface KeyInformation {
  privateKey: string
  keyId: string
}

type Headers = SignatureHeaders & Partial<ContentHeaders>

export class PaymentFlowService {
  client: AuthenticatedClient

  sendingPaymentPointerUrl: string
  receivingPaymentPointerUrl: string

  incomingPaymentUrlId: string
  quoteUrlId: string

  token: string
  interactRef: string

  manageUrl: string

  amount: string | number

  sendingWalletAddress: WalletAddress
  receivingWalletAddress: WalletAddress

  constructor(
    sendingPaymentPointerUrl: string,
    receivingPaymentPointerUrl: string,
    amount: string,
  ) {
    this.sendingPaymentPointerUrl = sendingPaymentPointerUrl
    this.receivingPaymentPointerUrl = receivingPaymentPointerUrl
    this.amount = amount
  }

  private async getPrivateKeyInformation(): Promise<KeyInformation> {
    return new Promise(res => {
      chrome.storage.local.get(['privateKey', 'keyId'], data => {
        if (data.privateKey && data.keyId) {
          res(data as KeyInformation)
        } else {
          throw new Error('Could not create OpenPayments client. Missing `privateKey` and `keyId`.')
        }
      })
    })
  }

  private createContentHeaders(body: string): ContentHeaders {
    return {
      'Content-Digest': createContentDigestHeader(JSON.stringify(JSON.parse(body)), ['sha-512']),
      'Content-Length': new TextEncoder().encode(body).length.toString(),
      'Content-Type': 'application/json',
    }
  }

  private createSigner(key: Uint8Array, keyId: string) {
    return {
      id: keyId,
      alg: 'ed25519',
      async sign(data: Uint8Array) {
        return Buffer.from(await ed.signAsync(data, key.slice(16)))
      },
    }
  }

  private async createSignatureHeaders({
    request,
    privateKey,
    keyId,
  }: SignOptions): Promise<SignatureHeaders> {
    const components = ['@method', '@target-uri']
    if (request.headers['Authorization'] || request.headers['authorization']) {
      components.push('authorization')
    }

    if (request.body) {
      components.push('content-digest', 'content-length', 'content-type')
    }

    const signingKey = this.createSigner(privateKey, keyId)
    const { headers } = await signMessage(
      {
        name: 'sig1',
        params: ['alg', 'keyid', 'created'],
        fields: components,
        key: signingKey,
      },
      request,
    )

    return {
      Signature: headers['Signature'] as string,
      'Signature-Input': headers['Signature-Input'] as string,
    }
  }

  private async createHeaders({ request, privateKey, keyId }: SignOptions): Promise<Headers> {
    if (request.body) {
      const contentHeaders = this.createContentHeaders(request.body)
      request.headers = { ...request.headers, ...contentHeaders }
    }

    const signatureHeaders = await this.createSignatureHeaders({ request, privateKey, keyId })

    return {
      ...request.headers,
      ...signatureHeaders,
    }
  }

  async createOpenPaymentsClient() {
    const { privateKey, keyId } = await this.getPrivateKeyInformation()
    this.client = await createAuthenticatedClient({
      walletAddressUrl: this.sendingWalletAddress.id,
      requestInterceptor: async config => {
        if (!config.method || !config.url) {
          throw new Error('Cannot intercept request: url or method missing')
        }

        const headers = await this.createHeaders({
          request: {
            method: config.method,
            url: config.url,
            headers: JSON.parse(JSON.stringify(config.headers)),
            body: config.data ? JSON.stringify(config.data) : undefined,
          },
          privateKey: ed.etc.hexToBytes(privateKey),
          keyId,
        })

        if (config.data) {
          config.headers['Content-Type'] = headers['Content-Type']
          config.headers['Content-Length'] = headers['Content-Length']
          config.headers['Content-Digest'] = headers['Content-Digest']
        }

        config.headers['Signature'] = headers['Signature']
        config.headers['Signature-Input'] = headers['Signature-Input']

        return config
      },
    })
  }

  async initPaymentFlow() {
    this.sendingWalletAddress = await this.getWalletAddress(this.sendingPaymentPointerUrl)
    this.receivingWalletAddress = await this.getWalletAddress(this.receivingPaymentPointerUrl)
    await this.createOpenPaymentsClient()

    const incomingPaymentGrant = await this.client.grant.request(
      {
        url: this.receivingWalletAddress.authServer,
      },
      {
        access_token: {
          access: [
            {
              type: 'incoming-payment',
              actions: ['create', 'read', 'list'],
              identifier: this.receivingWalletAddress.id,
            },
          ],
        },
      },
    )

    if (isPendingGrant(incomingPaymentGrant)) {
      throw new Error('Expected non-interactive grant. Received pending grant.')
    }

    const incomingPayment = await this.client.incomingPayment.create(
      {
        url: this.receivingWalletAddress.resourceServer,
        accessToken: incomingPaymentGrant.access_token.value,
      },
      {
        walletAddress: this.receivingWalletAddress.id,
        expiresAt: new Date(Date.now() + 6000 * 60 * 10).toISOString(),
        metadata: {
          source: 'Web Monetization',
        },
      },
    )

    this.incomingPaymentUrlId = incomingPayment.id

    const quoteAndOPGrant = await this.client.grant.request(
      {
        url: this.receivingWalletAddress.authServer,
      },
      {
        access_token: {
          access: [
            {
              type: 'quote',
              actions: ['create'],
            },
            {
              type: 'outgoing-payment',
              actions: ['create'],
              identifier: this.sendingWalletAddress.id,
              limits: {
                debitAmount: {
                  value: String(Number(this.amount) * 10 ** this.sendingWalletAddress.assetScale),
                  assetScale: this.sendingWalletAddress.assetScale, // 9
                  assetCode: this.sendingWalletAddress.assetCode,
                },
              },
            },
          ],
        },
        interact: {
          start: ['redirect'],
          finish: {
            method: 'redirect',
            uri: 'http://localhost:3344',
            nonce: new Date().getTime().toString(),
          },
        },
      },
    )

    if (!isPendingGrant(quoteAndOPGrant)) {
      throw new Error('Expected interactive grant. Received non-pending grant.')
    }

    const interactRef = await this.confirmPayment(quoteAndOPGrant.interact.redirect)

    const continuation = await this.client.grant.continue(
      {
        url: quoteAndOPGrant.continue.uri,
        accessToken: quoteAndOPGrant.continue.access_token.value,
      },
      {
        interact_ref: interactRef,
      },
    )

    if (!isFinalizedGrant(continuation)) {
      throw new Error('Expected finalized grant. Received unfinalized grant.')
    }

    this.manageUrl = continuation.access_token.manage
    this.token = continuation.access_token.value

    const currentTabId = await this.getCurrentActiveTabId()
    await tabs.sendMessage(currentTabId ?? 0, { type: 'START_PAYMENTS' })
  }

  async getWalletAddress(paymentPointerUrl: string): Promise<WalletAddress> {
    const response = await fetch(paymentPointerUrl, {
      headers: {
        Accept: 'application/json',
      },
    })
    const json = await response.json()

    if (!this.isWalletAddress(json)) {
      throw new Error('Invalid wallet address response.')
    }

    return json
  }

  private isWalletAddress(o: any): o is WalletAddress {
    return (
      o.id &&
      typeof o.id === 'string' &&
      o.assetScale &&
      typeof o.assetScale === 'number' &&
      o.assetCode &&
      typeof o.assetCode === 'string' &&
      o.authServer &&
      typeof o.authServer === 'string' &&
      o.resourceServer &&
      typeof o.resourceServer === 'string'
    )
  }

  async sendPayment() {
    // (1) TODO: Use the amount that is derived from the rate of pay
    // (2) TODO: Rotate token if it expired

    // Notice: The same access token is utilized for both quotes and outgoing payments.
    // During the grant request process, it is possible to specify multiple accesses. (see L224).
    // Employing a singular access token simplifies the process by eliminating the need to manage two separate access tokens for the sending side.
    const AMOUNT = 0.02
    const quote = await this.client.quote.create(
      {
        url: this.sendingWalletAddress.resourceServer,
        accessToken: this.token,
      },
      {
        method: 'ilp',
        receiver: this.incomingPaymentUrlId,
        walletAddress: this.sendingWalletAddress.id,
        debitAmount: {
          value: String(AMOUNT * 10 ** this.sendingWalletAddress.assetScale),
          assetScale: this.sendingWalletAddress.assetScale,
          assetCode: this.sendingWalletAddress.assetCode,
        },
      },
    )

    const outgoingPayment = await this.client.outgoingPayment.create(
      {
        url: this.sendingWalletAddress.resourceServer,
        accessToken: this.token,
      },
      {
        walletAddress: this.sendingWalletAddress.id,
        quoteId: quote.id,
        metadata: {
          source: 'Web Monetization',
        },
      },
    )

    const {
      receiveAmount,
      receiver: incomingPayment,
      walletAddress: paymentPointer,
    } = outgoingPayment

    const currentTabId = await this.getCurrentActiveTabId()
    await tabs.sendMessage(currentTabId ?? 0, {
      type: 'PAYMENT_SUCCESS',
      data: { receiveAmount, incomingPayment, paymentPointer },
    })
  }

  async getCurrentActiveTabId() {
    const activeTabs = await tabs.query({ active: true, currentWindow: true })
    return activeTabs[0].id
  }

  private async confirmPayment(url: string): Promise<string> {
    const currentTabId = await this.getCurrentActiveTabId()

    return await new Promise<string>(res => {
      if (url) {
        tabs.create({ url }).then(tab => {
          if (tab.id) {
            tabs.onUpdated.addListener((tabId, changeInfo) => {
              try {
                const tabUrl = new URL(changeInfo.url || '')
                const interactRef = tabUrl.searchParams.get('interact_ref')

                if (tabId === tab.id && interactRef) {
                  tabs.update(currentTabId, { active: true })
                  tabs.remove(tab.id)
                  res(interactRef)
                }
              } catch (e) {
                // do nothing
              }
            })
          }
        })
      }
    })
  }
}
