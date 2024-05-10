import { WalletAmount } from 'shared/types'
import {
  type AuthenticatedClient,
  createAuthenticatedClient
} from '@interledger/open-payments/dist/client'
import {
  isFinalizedGrant,
  isPendingGrant,
  WalletAddress
} from '@interledger/open-payments/dist/types'
import * as ed from '@noble/ed25519'
import { type Request } from 'http-message-signatures'
import { signMessage } from 'http-message-signatures/lib/httpbis'
import { createContentDigestHeader } from 'httpbis-digest-headers'
import { Browser } from 'webextension-polyfill'
import {
  getCurrentActiveTab,
  getExchangeRates,
  getRateOfPay,
  toAmount
} from '../utils'
import { StorageService } from '@/background/services/storage'
import { exportJWK, generateEd25519KeyPair } from '@/shared/crypto'
import { bytesToHex } from '@noble/hashes/utils'
import { getWalletInformation } from '@/shared/helpers'
import { ConnectWalletPayload } from '@/shared/messages'
import {
  DEFAULT_RATE_OF_PAY,
  MAX_RATE_OF_PAY,
  MIN_RATE_OF_PAY
} from '../config'

interface KeyInformation {
  privateKey: string
  keyId: string
}

interface InteractionParams {
  interactRef: string
  hash: string
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
type Headers = SignatureHeaders & Partial<ContentHeaders>

interface RequestLike extends Request {
  body?: string
}

interface SignOptions {
  request: RequestLike
  privateKey: Uint8Array
  keyId: string
}

interface VerifyInteractionHashParams {
  clientNonce: string
  interactRef: string
  interactNonce: string
  hash: string
  authServer: string
}

interface CreateQuoteAndOutgoingPaymentGrantParams {
  clientNonce: string
  walletAddress: WalletAddress
  amount: WalletAmount
}

export class OpenPaymentsService {
  client?: AuthenticatedClient

  constructor(
    private browser: Browser,
    private storage: StorageService
  ) {
    ;(async () => {
      const { connected, walletAddress } = await this.storage.get([
        'connected',
        'walletAddress'
      ])
      if (connected === true && walletAddress) {
        this.initClient(walletAddress.id)
      }
    })()
  }

  private async getPrivateKeyInformation(): Promise<KeyInformation> {
    const data = await this.browser.storage.local.get(['privateKey', 'keyId'])

    if (data.privateKey && data.keyId) {
      return data as KeyInformation
    }

    throw new Error(
      'Could not create OpenPayments client. Missing `privateKey` and `keyId`.'
    )
  }

  private createContentHeaders(body: string): ContentHeaders {
    return {
      'Content-Digest': createContentDigestHeader(
        JSON.stringify(JSON.parse(body)),
        ['sha-512']
      ),
      'Content-Length': new TextEncoder().encode(body).length.toString(),
      'Content-Type': 'application/json'
    }
  }

  private createSigner(key: Uint8Array, keyId: string) {
    return {
      id: keyId,
      alg: 'ed25519',
      async sign(data: Uint8Array) {
        return Buffer.from(await ed.signAsync(data, key.slice(16)))
      }
    }
  }

  private async createSignatureHeaders({
    request,
    privateKey,
    keyId
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
        params: ['keyid', 'created'],
        fields: components,
        key: signingKey
      },
      {
        url: request.url,
        method: request.method,
        headers: request.headers
      }
    )

    return {
      Signature: headers['Signature'] as string,
      'Signature-Input': headers['Signature-Input'] as string
    }
  }

  private async createHeaders({
    request,
    privateKey,
    keyId
  }: SignOptions): Promise<Headers> {
    if (request.body) {
      const contentHeaders = this.createContentHeaders(request.body)
      request.headers = { ...request.headers, ...contentHeaders }
    }

    const signatureHeaders = await this.createSignatureHeaders({
      request,
      privateKey,
      keyId
    })

    return {
      ...request.headers,
      ...signatureHeaders
    }
  }

  async initClient(walletAddressUrl: string) {
    const { privateKey, keyId } = await this.getPrivateKeyInformation()

    this.client = await createAuthenticatedClient({
      validateResponses: false,
      walletAddressUrl,
      authenticatedRequestInterceptor: async (request) => {
        if (!request.method || !request.url) {
          throw new Error('Cannot intercept request: url or method missing')
        }

        const initialRequest = request.clone()

        const headers = await this.createHeaders({
          request: {
            method: request.method,
            url: request.url,
            headers: JSON.parse(
              JSON.stringify(Object.fromEntries(request.headers))
            ),
            body: request.body
              ? JSON.stringify(await request.json())
              : undefined
          },
          privateKey: ed.etc.hexToBytes(privateKey),
          keyId
        })

        if (request.body) {
          initialRequest.headers.set(
            'Content-Type',
            headers['Content-Type'] as string
          )
          initialRequest.headers.set(
            'Content-Digest',
            headers['Content-Digest'] as string
          )
        }

        initialRequest.headers.set('Signature', headers['Signature'])
        initialRequest.headers.set(
          'Signature-Input',
          headers['Signature-Input']
        )

        return initialRequest
      }
    })
  }

  async connectWallet({
    walletAddressUrl,
    amount,
    recurring
  }: ConnectWalletPayload) {
    const walletAddress = await getWalletInformation(walletAddressUrl)
    const exchangeRates = await getExchangeRates()

    let rateOfPay = DEFAULT_RATE_OF_PAY
    let minRateOfPay = MIN_RATE_OF_PAY
    let maxRateOfPay = MAX_RATE_OF_PAY

    if (!exchangeRates.rates[walletAddress.assetCode]) {
      throw new Error(`Exchange rate for ${walletAddress.assetCode} not found.`)
    }

    const exchangeRate = exchangeRates.rates[walletAddress.assetCode]
    rateOfPay = getRateOfPay({
      rate: DEFAULT_RATE_OF_PAY,
      exchangeRate,
      assetScale: walletAddress.assetScale
    })
    minRateOfPay = getRateOfPay({
      rate: MIN_RATE_OF_PAY,
      exchangeRate,
      assetScale: walletAddress.assetScale
    })
    maxRateOfPay = getRateOfPay({
      rate: MAX_RATE_OF_PAY,
      exchangeRate,
      assetScale: walletAddress.assetScale
    })

    const transformedAmount = toAmount({
      value: amount,
      recurring,
      assetScale: walletAddress.assetScale
    })

    await this.initClient(walletAddress.id)
    const clientNonce = crypto.randomUUID()
    const grant = await this.createQuoteAndOutgoingPaymentGrant({
      clientNonce,
      walletAddress,
      amount: transformedAmount
    })

    // Q: Should this be moved to continuation polling?
    // https://github.com/interledger/open-payments/issues/385
    const { interactRef, hash } = await this.confirmPayment(
      grant.interact.redirect
    )

    // TODO: Check with Fynbos if the auth server routes have `/gnap` before them.
    await this.verifyInteractionHash({
      clientNonce,
      interactNonce: grant.interact.finish,
      interactRef,
      hash,
      authServer: walletAddress.authServer
    })

    const continuation = await this.client!.grant.continue(
      {
        url: grant.continue.uri,
        accessToken: grant.continue.access_token.value
      },
      {
        interact_ref: interactRef
      }
    )

    if (!isFinalizedGrant(continuation)) {
      throw new Error('Expected finalized grant. Received unfinalized grant.')
    }

    this.storage.set({
      walletAddress,
      rateOfPay,
      minRateOfPay,
      maxRateOfPay,
      amount: transformedAmount,
      token: {
        value: continuation.access_token.value,
        manage: continuation.access_token.manage
      },
      grant: {
        accessToken: continuation.continue.access_token.value,
        continueUri: continuation.continue.uri
      },
      connected: true
    })
  }

  private async createQuoteAndOutgoingPaymentGrant({
    amount,
    walletAddress,
    clientNonce
  }: CreateQuoteAndOutgoingPaymentGrantParams) {
    const grant = await this.client!.grant.request(
      {
        url: walletAddress.authServer
      },
      {
        access_token: {
          access: [
            {
              type: 'quote',
              actions: ['create']
            },
            {
              type: 'outgoing-payment',
              actions: ['create'],
              identifier: walletAddress.id,
              limits: {
                debitAmount: {
                  value: amount.value,
                  assetScale: walletAddress.assetScale,
                  assetCode: walletAddress.assetCode
                },
                interval: amount.interval
              }
            }
          ]
        },
        interact: {
          start: ['redirect'],
          finish: {
            method: 'redirect',
            uri: 'http://localhost:3344',
            nonce: clientNonce
          }
        }
      }
    )

    if (!isPendingGrant(grant)) {
      throw new Error('Expected interactive grant. Received non-pending grant.')
    }

    return grant
  }

  // Fourth item- https://rafiki.dev/concepts/open-payments/grant-interaction/#endpoints
  private async verifyInteractionHash({
    clientNonce,
    interactRef,
    interactNonce,
    hash,
    authServer
  }: VerifyInteractionHashParams): Promise<void> {
    // Notice: The interaction hash is not correctly calculated within Rafiki at the momenet in certain scenarios.
    // If at one point this will throw an error check the `grantEndpoint` value.
    // `grantEndpoint` represents the route where grants are requested.
    const grantEndpoint = new URL(authServer).origin + '/'
    const data = new TextEncoder().encode(
      `${clientNonce}\n${interactNonce}\n${interactRef}\n${grantEndpoint}`
    )

    const digest = await crypto.subtle.digest('SHA-256', data)
    const calculatedHash = btoa(
      String.fromCharCode.apply(null, new Uint8Array(digest))
    )
    if (calculatedHash !== hash) throw new Error('Invalid interaction hash')
  }

  private async confirmPayment(url: string): Promise<InteractionParams> {
    const currentTab = await getCurrentActiveTab(this.browser)

    return await new Promise((res) => {
      if (url) {
        this.browser.tabs.create({ url }).then((tab) => {
          if (tab.id) {
            this.browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
              try {
                const tabUrl = new URL(changeInfo.url || '')
                const interactRef = tabUrl.searchParams.get('interact_ref')
                const hash = tabUrl.searchParams.get('hash')

                if (tabId === tab.id && interactRef && hash) {
                  this.browser.tabs.update(currentTab.id, { active: true })
                  this.browser.tabs.remove(tab.id)
                  res({ interactRef, hash })
                }
              } catch (e) {
                /* do nothing */
              }
            })
          }
        })
      }
    })
  }

  async disconnectWallet() {
    const { grant } = await this.storage.get(['grant'])

    if (grant) {
      await this.client!.grant.cancel({
        url: grant.continueUri,
        accessToken: grant.accessToken
      })
      await this.storage.clear()
    }
  }

  async genererateKeys() {
    if (await this.storage.keyPairExists()) return

    const { privateKey, publicKey } = await generateEd25519KeyPair()
    const keyId = crypto.randomUUID()
    const jwk = exportJWK(publicKey, keyId)

    await this.storage.set({
      privateKey: bytesToHex(privateKey),
      publicKey: btoa(JSON.stringify(jwk)),
      keyId
    })
  }
}
